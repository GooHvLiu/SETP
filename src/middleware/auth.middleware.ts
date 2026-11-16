/**
 * ============================================================
 * 鉴权中间件（middleware/auth.middleware.ts）
 * ------------------------------------------------------------
 * 提供：
 *   - requireAuth：通用登录校验中间件（手写路由用）
 *     校验 Access Token（type=access），解析通过后挂载 req.user
 *   - requirePermission：通用权限校验中间件（手写路由用）
 *     requireAuth 之后使用，按权限码校验 RBAC
 *   - expressAuthentication：TSOA 自动生成的 routes 调用的鉴权入口
 *     （@Security("bearerAuth") 会走这里，scopes 传权限码）
 *
 * 权限校验逻辑（RBAC）：
 *   1. 校验 Access Token（type=access）
 *   2. 查询用户当前角色绑定的菜单权限码集合
 *   3. 校验请求所需的权限码是否在集合内
 * ============================================================
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import jwtConfig from "../config/jwt.config";
import { prisma } from "../db/prisma";
import { ERROR_CODE } from "../constants/errorCode";

/**
 * 用户权限码缓存：高 QPS 下避免每次请求都做 user_roles -> role_menus -> menus 查询。
 * 会话校验仍每次查库，保证踢下线即时生效；权限变更最多延迟一个 TTL。
 */
const PERMISSION_CACHE_TTL_MS = 30_000;
const permissionCache = new Map<number, { permissions: string[]; expiresAt: number }>();

/** 清除权限缓存；传 userId 只清该用户，不传清全部 */
export function clearPermissionCache(userId?: number): void {
  if (userId === undefined) {
    permissionCache.clear();
    return;
  }
  permissionCache.delete(userId);
}

/**
 * 查询用户拥有的全部权限码（RBAC 核心查询）
 * users -> user_roles -> roles -> role_menus -> menus
 * 只取 type=BUTTON/MENU 且 permission 非空的权限码
 */
async function getUserPermissions(userId: number): Promise<string[]> {
  const cached = permissionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.permissions;

  const userRoles = await prisma.userRole.findMany({
    where: { userId, role: { status: 1 } },
    include: {
      role: {
        include: {
          menus: {
            include: {
              menu: true,
            },
          },
        },
      },
    },
  });

  const permissionSet = new Set<string>();
  for (const ur of userRoles) {
    for (const rm of ur.role.menus) {
      // 只认启用且未删除的菜单权限，停用/回收站的权限码不再生效
      if (rm.menu.permission && rm.menu.status === 1 && rm.menu.isDeleted === 0) {
        permissionSet.add(rm.menu.permission);
      }
    }
  }
  const permissions = Array.from(permissionSet);
  permissionCache.set(userId, { permissions, expiresAt: Date.now() + PERMISSION_CACHE_TTL_MS });
  return permissions;
}

/**
 * 校验令牌所属会话是否仍然可用（「踢下线」即时生效的关键）
 * 会话即 refresh_tokens 中的一条记录，以下任一情况视为失效：
 *   1. 令牌未携带会话号（旧版令牌）或会话不存在
 *   2. 会话已被吊销（踢下线 / 登出 / 换设备登录顶号）
 *   3. 会话已过期
 *   4. 用户已软删、已禁用，或令牌版本与库内不一致
 */
/**
 * 强制改密期间允许访问的接口（其余接口一律返回 PASSWORD_CHANGE_REQUIRED）
 * 只放改密、读取自身资料与登出，保证用户能完成改密并安全退出。
 */
const PASSWORD_CHANGE_ALLOWED_PATHS = new Set(["/api/v1/auth/password/change", "/api/v1/auth/profile", "/api/v1/auth/logout"]);

/** 去除末尾斜杠后匹配白名单 */
function isPasswordChangeAllowed(reqPath: string): boolean {
  return PASSWORD_CHANGE_ALLOWED_PATHS.has(reqPath.replace(/\/+$/, ""));
}

/** 首次登录未改密时统一抛出的业务错误 */
function passwordChangeRequiredError(): { name: string; message: string; status: number } {
  return { name: "PasswordChangeRequired", message: "PASSWORD_CHANGE_REQUIRED", status: 400 };
}

async function getSessionState(payload: any): Promise<{ usable: boolean; mustChangePassword: boolean }> {
  const sid = Number(payload?.sid);
  if (!Number.isInteger(sid) || sid <= 0) return { usable: false, mustChangePassword: false };

  const row = await prisma.refreshToken.findUnique({
    where: { id: sid },
    select: {
      revoked: true,
      expiresAt: true,
      user: { select: { tokenVersion: true, isDeleted: true, status: true, mustChangePassword: true } },
    },
  });
  if (!row || row.revoked || row.expiresAt.getTime() <= Date.now()) {
    return { usable: false, mustChangePassword: false };
  }
  if (!row.user || row.user.isDeleted !== 0 || row.user.status !== 1) {
    return { usable: false, mustChangePassword: false };
  }
  if (row.user.tokenVersion !== payload.v) {
    return { usable: false, mustChangePassword: false };
  }
  return { usable: true, mustChangePassword: row.user.mustChangePassword === 1 };
}

/** 从 Authorization 头解析并校验 Access Token，返回 decoded 或错误对象 */
function verifyAccessToken(
  req: Request
): { ok: true; decoded: any } | { ok: false; error: { name: string; message: string; status: number } } {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, error: { name: "Unauthorized", message: "No token provided", status: 401 } };
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded: any = jwt.verify(token, jwtConfig.secret);
    // 只用 Access Token 做鉴权（type=access），防止 refresh 冒充
    if (decoded.type !== "access") {
      return { ok: false, error: { name: "JsonWebTokenError", message: "Invalid token type", status: 401 } };
    }
    return { ok: true, decoded };
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") {
      return { ok: false, error: { name: "TokenExpiredError", message: "Token expired", status: 401 } };
    }
    return { ok: false, error: { name: "JsonWebTokenError", message: "Invalid token", status: 401 } };
  }
}

/**
 * 通用登录校验中间件（手写路由用）
 * 用法：router.get("/list", requireAuth, handler)
 * 校验通过后 req.user = { userId, username, ... }；失败交给 errorHandler（10101/10102/10103）
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const result = verifyAccessToken(req);
  if (!result.ok) {
    next(result.error);
    return;
  }
  // 会话校验：会话被吊销/过期、用户禁用或软删、令牌版本变化 → 旧令牌立即失效
  const session = await getSessionState(result.decoded);
  if (!session.usable) {
    next({ name: "JsonWebTokenError", message: "Session invalid", status: 401 });
    return;
  }
  // 首次登录未改密：只允许改密、读取自身资料与登出，其余接口一律拦截
  if (session.mustChangePassword && !isPasswordChangeAllowed(req.path)) {
    next(passwordChangeRequiredError());
    return;
  }
  (req as any).user = { ...result.decoded, mustChangePassword: session.mustChangePassword };
  next();
}

/**
 * 通用权限校验中间件（手写路由用）
 * 用法：router.get("/list", requireAuth, requirePermission("adminCenter:user:list"), handler)
 * 注意：权限校验依赖 req.user（必须先经过 requireAuth 或手动挂载）
 */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user as { userId: number } | undefined;
    if (!user) {
      res.error(ERROR_CODE.UNAUTHORIZED);
      return;
    }

    const perms = await getUserPermissions(user.userId);
    if (!perms.includes(permission)) {
      res.error(ERROR_CODE.PERMISSION_DENIED);
      return;
    }
    next();
  };
}

/**
 * TSOA 认证中间件入口（兼容保留，供 @tsoa 自动生成的路由使用）
 * TSOA 自动生成的 routes.ts 会调用这个函数
 * 用法（controller 内）：
 *   @Security("bearerAuth")               // 只要登录
 *   @Security("bearerAuth", ["adminCenter:user:list"])  // 需要指定权限码
 */
export async function expressAuthentication(request: Request, securityName: string, scopes?: string[]): Promise<any> {
  if (!securityName) return {} as any;

  if (securityName !== "bearerAuth") {
    throw { name: "Unauthorized", message: "Unsupported security scheme" };
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw { name: "Unauthorized", message: "No token provided" };
  }

  const token = authHeader.split(" ")[1];

  // 解析并校验 token（区分过期/无效/类型错误，error.middleware 按 name 映射 10102/10103）
  let decoded: any;
  try {
    decoded = jwt.verify(token, jwtConfig.secret);
  } catch (err: any) {
    // TokenExpiredError → 10102；JsonWebTokenError → 10103
    if (err?.name === "TokenExpiredError") {
      throw { name: "TokenExpiredError", message: "Token expired" };
    }
    throw { name: "JsonWebTokenError", message: "Invalid token" };
  }

  // 只用 Access Token 做鉴权（type=access），防止 refresh 冒充
  if (decoded.type !== "access") {
    throw { name: "JsonWebTokenError", message: "Invalid token type" };
  }

  // 会话校验：会话被吊销/过期、用户禁用或软删、令牌版本变化 → 旧令牌立即失效
  const session = await getSessionState(decoded);
  if (!session.usable) {
    throw { name: "JsonWebTokenError", message: "Session invalid" };
  }
  // 首次登录未改密：只允许改密、读取自身资料与登出，其余接口一律拦截
  if (session.mustChangePassword && !isPasswordChangeAllowed(request.path)) {
    throw passwordChangeRequiredError();
  }

  // 需要权限码时，查 RBAC 权限集合并校验
  if (scopes && scopes.length > 0) {
    let perms: string[];
    try {
      perms = await getUserPermissions(decoded.userId);
    } catch {
      throw { name: "Unauthorized", message: "Permission check failed" };
    }
    const hasAll = scopes.every((s) => perms.includes(s));
    if (!hasAll) {
      throw { name: "Forbidden", message: "Permission denied" };
    }
  }

  // 把用户信息挂到 request 上
  (request as any).user = { ...decoded, mustChangePassword: session.mustChangePassword };
  return decoded;
}
