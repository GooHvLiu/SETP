/**
 * ============================================================
 * 认证服务（modules/auth/auth.service.ts）
 * ------------------------------------------------------------
 * 职责：
 *   1. 登录：验证码校验 → 账号锁定检查 → 查用户 → 校验密码
 *      → 失败计数/锁定 → 签发双令牌（access + refresh）
 *   2. 刷新：校验 refresh token → 查库确认未吊销 → 签发新 access
 *   3. 登出：吊销 refresh token（DB 标记 revoked）
 *   4. 注册：用户名查重 + 密码强度校验 + 哈希存储
 * ------------------------------------------------------------
 * 安全设计：
 *   - 账号锁定：连续失败 LOGIN_MAX_FAILURES 次锁定 LOGIN_LOCK_MINUTES 分钟
 *   - Refresh Token 只存哈希入库（泄露不可复用，登出可吊销）
 *   - 密码 bcrypt 哈希存储，禁止明文
 * ============================================================
 */

import { prisma, withTransaction } from "@src/db/prisma";
import { DEFAULT_ROLE_LEVEL, ROLE_LEVEL, SUPER_ADMIN_USERNAME } from "@src/constants/role";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@src/utils/jwt";
import { hashPassword, comparePassword, checkPasswordStrength } from "@src/utils/password";
import { hashToken } from "@src/utils/tokenHash";
import { randomInt } from "crypto";
import mailService from "../mail/mail.service";
import notificationService from "../notification/notification.service";
import captchaService from "../captcha/captcha.service";
import menuService from "../menu/menu.service";
import { getConfigBoolean, getConfigNumber } from "@src/config/runtimeConfig";
import jwtConfig from "@src/config/jwt.config";
import logger from "@src/utils/logger";
import { ERROR_CODE } from "@src/constants/errorCode";
import { BusinessError } from "@src/errors/BusinessError";
import type { RoleBriefDto } from "./auth.model";

/** 解析时长字符串为毫秒：支持 "15m" / "7d" / "2h" / "30s" / 纯数字(秒) */
function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)\s*(s|m|h|d)?$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // 兜底 7 天
  const value = Number(match[1]);
  const unit = (match[2] || "s").toLowerCase();
  const unitMs: Record<string, number> = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return value * unitMs[unit];
}

/** 忘记密码验证码有效期（分钟） */
const PASSWORD_RESET_CODE_TTL_MINUTES = 10;
/** 同一账号两次申请的最小间隔（秒） */
const PASSWORD_RESET_RESEND_SECONDS = 60;
/** 同一验证码允许尝试次数 */
const PASSWORD_RESET_MAX_ATTEMPTS = 5;

/** 邮箱匹配统一小写，避免大小写差异导致账号匹配失败 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** 生成 6 位数字验证码（保留前导零） */
function createResetCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** 验证码哈希：绑定用户、邮箱与验证码，库中不存明文 */
function hashResetCode(userId: number, email: string, code: string): string {
  return hashToken(`${userId}:${email}:${code}`);
}

/** 当前用户 RBAC 上下文：主角色 + 启用角色列表 + 权限码并集 */
interface UserRbac {
  role: string | null;
  roles: RoleBriefDto[];
  permissions: string[];
}

class AuthService {
  /**
   * 用户名密码登录（带验证码）
   */
  async login(username: string, password: string, captchaId: string, captchaCode: string) {
    // 0. 先校验图形验证码（防自动化爆破）
    captchaService.verifyCaptcha(captchaCode, captchaId);

    // 1. 账号锁定检查（按用户名，用户名唯一）
    const attempt = await prisma.loginAttempt.findUnique({ where: { username } });
    if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) {
      throw new Error("ACCOUNT_LOCKED");
    }

    // 2. 查询用户（排除软删除）
    const user = await prisma.user.findFirst({
      where: { username, isDeleted: 0 },
    });

    // 3. 用户不存在 → 记录失败并抛错
    if (!user) {
      await this.recordFailure(username);
      throw new Error("USER_NOT_EXIST");
    }

    // 4. 校验密码（失败 → 记录失败并抛错）
    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      await this.recordFailure(username);
      throw new Error("USER_PASSWORD_ERROR");
    }

    // 5. 检查账号状态：0 禁用、2 自助注册待审核
    if (user.status === 2) {
      throw new Error("USER_PENDING_APPROVAL");
    }
    if (user.status === 0) {
      throw new Error("USER_DISABLED");
    }

    // 6. 登录成功：清空失败计数、更新最后登录时间
    const loginAt = new Date();
    await prisma.loginAttempt.deleteMany({ where: { username } });
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: loginAt },
    });

    // 7. 签发双令牌（access 短期 / refresh 长期入库）
    //    载荷携带 token_version：改密/禁用/删除后版本 +1，旧令牌立即失效
    //    先落库拿到会话号，再签 access 并携带 sid：吊销该会话后 access 立即失效
    const refreshToken = signRefreshToken({ userId: user.id, username: user.username, v: user.tokenVersion, isSuper: user.isSuper });
    const sessionId = await this.saveRefreshToken(user.id, refreshToken);
    const accessToken = signAccessToken({
      userId: user.id,
      username: user.username,
      v: user.tokenVersion,
      isSuper: user.isSuper,
      sid: sessionId,
    });

    // 8. 查询用户角色 / 权限码 + 可见菜单树（RBAC，并行查询）
    //    role：主角色（仅展示）；roles：启用角色列表；permissions：按钮级控制；menus：前端动态路由
    const [rbac, menus] = await Promise.all([this.getUserRbac(user.id), menuService.getTreeByUser(user.id)]);

    return {
      token: accessToken,
      refreshToken,
      userInfo: {
        id: user.id,
        username: user.username,
        realName: user.realName,
        status: user.status,
        createdAt: user.createdAt,
        lastLoginAt: loginAt,
        mustChangePassword: user.mustChangePassword === 1,
        role: rbac.role,
        roles: rbac.roles,
        permissions: rbac.permissions,
        menus,
      },
    };
  }

  /**
   * 刷新令牌：一次性轮换
   * 旧 refresh token 立即吊销，新 refresh token 入库并返回；
   * 同一枚 refresh token 再次使用视为泄露重放，吊销该用户全部会话。
   */
  async refresh(refreshToken: string) {
    // 1. 校验签名 + type=refresh
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new Error("TOKEN_INVALID");
    }

    // 2. 按 tokenHash 唯一索引精确查库，确认未吊销且未过期
    const tokenHash = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.userId !== payload.userId || stored.expiresAt.getTime() <= Date.now()) {
      throw new Error("TOKEN_INVALID");
    }

    // 3. 已吊销令牌被再次使用：按重放处理，吊销该用户全部未吊销会话
    if (stored.revoked) {
      await prisma.refreshToken.updateMany({ where: { userId: payload.userId, revoked: false }, data: { revoked: true } });
      throw new Error("TOKEN_INVALID");
    }

    // 4. 校验用户状态 + 令牌版本（禁用/软删/改密后 refresh 拒绝，强制重新登录）
    const user = await prisma.user.findFirst({
      where: { id: payload.userId, isDeleted: 0 },
      select: { id: true, username: true, status: true, tokenVersion: true, isSuper: true },
    });
    if (!user || user.status !== 1 || user.tokenVersion !== payload.v) {
      throw new Error("TOKEN_INVALID");
    }

    // 5. 原子轮换：旧会话标记吊销，新 refresh token 入库，新 access 指向新会话
    const newRefreshToken = signRefreshToken({
      userId: user.id,
      username: user.username,
      v: user.tokenVersion,
      isSuper: user.isSuper,
    });
    const expiresAt = new Date(Date.now() + parseDurationToMs(jwtConfig.refreshExpiresIn));
    const newSessionId = await withTransaction(async (tx) => {
      const claimed = await tx.refreshToken.updateMany({ where: { id: stored.id, revoked: false }, data: { revoked: true } });
      if (claimed.count !== 1) {
        throw new Error("TOKEN_INVALID");
      }
      const created = await tx.refreshToken.create({
        data: { userId: user.id, tokenHash: hashToken(newRefreshToken), expiresAt },
        select: { id: true },
      });
      return created.id;
    });

    const accessToken = signAccessToken({
      userId: user.id,
      username: user.username,
      v: user.tokenVersion,
      isSuper: user.isSuper,
      sid: newSessionId,
    });
    return { token: accessToken, refreshToken: newRefreshToken };
  }

  /**
   * 登出：吊销该用户全部 refresh token
   */
  async logout(userId: number) {
    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }

  /**
   * 注册（演示用，正式项目按需开放）
   */
  async register(username: string, password: string, email: string, realName?: string) {
    // 0. 自助注册开关：默认关闭；管理员创建账号走 user 模块，不受该开关影响
    if (!getConfigBoolean("register_enabled")) {
      throw new Error("REGISTER_DISABLED");
    }

    // 1. 密码强度校验（具体原因只进内部日志，msg 保持 PASSWORD_WEAK 纯标识）
    const strength = checkPasswordStrength(password);
    if (!strength.valid) {
      if (strength.reason) logger.warn({ username }, `Password weak: ${strength.reason}`);
      throw new BusinessError(ERROR_CODE.PASSWORD_WEAK, "PASSWORD_WEAK", { field: "password" });
    }

    // 2.0 超级管理员保留名：禁止注册（防伪造隐藏账号）
    if (username === SUPER_ADMIN_USERNAME) {
      throw new BusinessError(ERROR_CODE.USER_ALREADY_EXIST, "USER_ALREADY_EXIST", { field: "username" });
    }

    // 2. 用户名查重
    const exist = await prisma.user.findFirst({
      where: { username, isDeleted: 0 },
    });
    if (exist) {
      throw new BusinessError(ERROR_CODE.USER_ALREADY_EXIST, "USER_ALREADY_EXIST", { field: "username" });
    }

    // 3. 密码哈希 + 创建用户（自助注册进入待审核，首次登录必须先改密）
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: hashedPassword,
        realName: realName || username,
        status: 2, // 待管理员审核，审核通过后才可登录
        mustChangePassword: 1, // 首次登录强制改密
      },
    });

    // 4. 绑定默认角色（viewer）
    const viewerRole = await prisma.role.findUnique({ where: { code: "viewer" } });
    if (viewerRole) {
      await prisma.userRole.create({ data: { userId: user.id, roleId: viewerRole.id } });
    }

    // 5. 通知管理员审核（站内必达，不发邮件，避免注册刷信）
    void notificationService
      .notify({
        roles: ["admin", "superAdmin"],
        category: "business",
        type: "info",
        title: "",
        content: "",
        titleKey: "notification.auth.registerPending.title",
        contentKey: "notification.auth.registerPending.content",
        data: { username },
        source: "auth",
        templateKey: "register_pending",
        sendEmail: false,
      })
      .catch((error) => logger.warn({ username, error: (error as Error)?.message }, "Register notification failed"));

    return { username, status: 2, approvalRequired: true };
  }

  /**
   * 获取当前登录用户信息（含权限码 + 可见菜单树）
   */
  async getProfile(userId: number) {
    const user = await prisma.user.findFirst({
      where: { id: userId, isDeleted: 0 },
    });
    if (!user) {
      throw new Error("USER_NOT_EXIST");
    }

    const [rbac, menus] = await Promise.all([this.getUserRbac(userId), menuService.getTreeByUser(userId)]);
    return {
      id: user.id,
      username: user.username,
      realName: user.realName,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      mustChangePassword: user.mustChangePassword === 1,
      role: rbac.role,
      roles: rbac.roles,
      permissions: rbac.permissions,
      menus,
    };
  }

  /**
   * 修改密码（自助改密；首次改密同样必须提供旧密码）
   * 成功后 tokenVersion +1 并吊销全部 refresh token，旧会话立即失效，必须重新登录。
   */
  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, isDeleted: 0 },
      select: { id: true, username: true, passwordHash: true, status: true },
    });
    if (!user) {
      throw new Error("USER_NOT_EXIST");
    }
    if (user.status === 2) {
      throw new Error("USER_PENDING_APPROVAL");
    }
    if (user.status === 0) {
      throw new Error("USER_DISABLED");
    }

    // 必须校验旧密码：即使处于首次强制改密状态，也不能跳过这一步
    const oldValid = await comparePassword(oldPassword, user.passwordHash);
    if (!oldValid) {
      throw new Error("USER_PASSWORD_ERROR");
    }

    const strength = checkPasswordStrength(newPassword);
    if (!strength.valid) {
      if (strength.reason) logger.warn({ username: user.username }, `Password weak: ${strength.reason}`);
      throw new BusinessError(ERROR_CODE.PASSWORD_WEAK, "PASSWORD_WEAK", { field: "newPassword" });
    }

    const sameAsOld = await comparePassword(newPassword, user.passwordHash);
    if (sameAsOld) {
      throw new Error("PASSWORD_SAME_AS_OLD");
    }

    const hashedPassword = await hashPassword(newPassword);
    await withTransaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: hashedPassword, mustChangePassword: 0, tokenVersion: { increment: 1 } },
      });
      await tx.refreshToken.updateMany({ where: { userId: user.id, revoked: false }, data: { revoked: true } });
    });

    void notificationService
      .notify({
        userIds: [user.id],
        category: "security",
        type: "success",
        title: "",
        content: "",
        titleKey: "notification.auth.passwordChanged.title",
        contentKey: "notification.auth.passwordChanged.content",
        source: "auth",
        templateKey: "password_changed",
        sendEmail: true,
      })
      .catch((error) => logger.warn({ userId: user.id, error: (error as Error)?.message }, "Password change notification failed"));

    return { reloginRequired: true };
  }

  /**
   * 申请重置密码验证码。
   * 用户名 + 邮箱双匹配：User.email 无唯一约束，单靠邮箱可能命中多个账号。
   * 账号不存在或邮箱不匹配时直接返回业务错误，不再进入验证码步骤。
   */
  async requestPasswordReset(username: string, email: string, captchaId: string, captchaCode: string) {
    captchaService.verifyCaptcha(captchaCode, captchaId);

    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findFirst({
      where: { username: username.trim(), isDeleted: 0, status: 1, isSuper: 0 },
    });

    if (!user || normalizeEmail(user.email || "") !== normalizedEmail) {
      logger.warn({ username: username.trim() }, "Password reset rejected: account or email mismatch");
      throw new Error("PASSWORD_RESET_ACCOUNT_NOT_FOUND");
    }

    const latest = await prisma.passwordResetCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    if (latest && Date.now() - latest.createdAt.getTime() < PASSWORD_RESET_RESEND_SECONDS * 1000) {
      const retryAfterSeconds = Math.ceil((PASSWORD_RESET_RESEND_SECONDS * 1000 - (Date.now() - latest.createdAt.getTime())) / 1000);
      logger.warn({ username: user.username, retryAfterSeconds }, "Password reset rejected: resend cooldown");
      throw new BusinessError(ERROR_CODE.PASSWORD_RESET_TOO_FREQUENT, "PASSWORD_RESET_TOO_FREQUENT", {
        retryAfterSeconds,
      });
    }

    const code = createResetCode();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MINUTES * 60 * 1000);

    // 同一账号只保留最新一枚有效验证码
    await prisma.passwordResetCode.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.passwordResetCode.create({
      data: {
        userId: user.id,
        email: normalizedEmail,
        codeHash: hashResetCode(user.id, normalizedEmail, code),
        expiresAt,
      },
    });

    try {
      await mailService.sendVerificationCode({
        to: normalizedEmail,
        code,
        expiresMinutes: PASSWORD_RESET_CODE_TTL_MINUTES,
        purpose: "重置密码",
        userId: user.id,
      });
    } catch (err) {
      // 发信失败不回传具体原因，否则可被用来判断「用户名 + 邮箱」是否匹配
      logger.warn({ username: user.username }, `Password reset mail failed: ${(err as Error)?.message || String(err)}`);
    }

    return { expiresMinutes: PASSWORD_RESET_CODE_TTL_MINUTES };
  }

  /**
   * 校验验证码并重置密码。
   * 成功后 tokenVersion +1、吊销全部 refresh token，所有旧会话立即失效。
   */
  async resetPassword(username: string, email: string, code: string, newPassword: string) {
    const strength = checkPasswordStrength(newPassword);
    if (!strength.valid) {
      if (strength.reason) logger.warn({ username }, `Password weak: ${strength.reason}`);
      throw new BusinessError(ERROR_CODE.PASSWORD_WEAK, "PASSWORD_WEAK", { field: "newPassword" });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findFirst({
      where: { username: username.trim(), isDeleted: 0, status: 1, isSuper: 0 },
    });
    if (!user || normalizeEmail(user.email || "") !== normalizedEmail) {
      throw new Error("PASSWORD_RESET_CODE_INVALID");
    }

    const record = await prisma.passwordResetCode.findFirst({
      where: { userId: user.id, email: normalizedEmail, usedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!record || record.expiresAt.getTime() <= Date.now()) {
      throw new Error("PASSWORD_RESET_CODE_INVALID");
    }
    if (record.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
      throw new Error("PASSWORD_RESET_TOO_MANY_ATTEMPTS");
    }

    const matched = record.codeHash === hashResetCode(user.id, normalizedEmail, code);
    if (!matched) {
      const attempts = record.attempts + 1;
      await prisma.passwordResetCode.update({ where: { id: record.id }, data: { attempts } });
      throw new Error(attempts >= PASSWORD_RESET_MAX_ATTEMPTS ? "PASSWORD_RESET_TOO_MANY_ATTEMPTS" : "PASSWORD_RESET_CODE_INVALID");
    }

    const hashedPassword = await hashPassword(newPassword);

    await withTransaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: hashedPassword, mustChangePassword: 0, tokenVersion: { increment: 1 } },
      });
      await tx.refreshToken.updateMany({ where: { userId: user.id }, data: { revoked: true } });
      await tx.loginAttempt.deleteMany({ where: { username: user.username } });
      await tx.passwordResetCode.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
    });

    void notificationService
      .notify({
        userIds: [user.id],
        category: "security",
        type: "success",
        title: "",
        content: "",
        titleKey: "notification.auth.passwordReset.title",
        contentKey: "notification.auth.passwordReset.content",
        source: "auth",
        templateKey: "password_reset",
        sendEmail: true,
      })
      .catch((error) => logger.warn({ userId: user.id, error: (error as Error)?.message }, "Password reset notification failed"));

    return { username: user.username };
  }

  /** 记录登录失败：唯一键原子自增，达到阈值写入锁定截止时间 */
  private async recordFailure(username: string): Promise<void> {
    const now = new Date();
    const threshold = getConfigNumber("login_max_failures");
    // 锁定已到期先把计数归零，否则历史失败次数会让下一次失败立即再次锁定
    await prisma.loginAttempt.updateMany({
      where: { username, lockedUntil: { lte: now } },
      data: { failedCount: 0, lockedUntil: null },
    });
    const attempt = await prisma.loginAttempt.upsert({
      where: { username },
      update: { failedCount: { increment: 1 }, lastAttemptAt: now },
      create: { username, failedCount: 1, lastAttemptAt: now },
    });

    if (attempt.failedCount >= threshold) {
      await prisma.loginAttempt.update({
        where: { username },
        data: { lockedUntil: new Date(now.getTime() + getConfigNumber("login_lock_minutes") * 60 * 1000) },
      });
    }
  }

  /** 保存 refresh token（只存哈希），返回会话号（refresh_tokens.id） */
  private async saveRefreshToken(userId: number, refreshToken: string): Promise<number> {
    // 先吊销旧 token，再存新的（单设备登录策略；如需多设备可去掉 deleteMany）
    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });

    // 过期时间从 env 配置读取（如 "7d"），与 jwt.config 的 refreshExpiresIn 联动
    const expiresAt = new Date(Date.now() + parseDurationToMs(jwtConfig.refreshExpiresIn));
    const created = await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt,
      },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * 查询当前用户 RBAC 上下文。
   * - 只统计启用角色（role.status=1），停用角色不贡献角色、权限与菜单；
   * - roles 按 ROLE_LEVEL 从高到低排序，role 取第一条作为主角色（仅用于展示）；
   * - permissions 是所有启用角色菜单权限的并集，权限判断只用它。
   */
  private async getUserRbac(userId: number): Promise<UserRbac> {
    const userRoles = await prisma.userRole.findMany({
      where: { userId, role: { status: 1 } },
      include: {
        role: {
          include: {
            menus: { include: { menu: true } },
          },
        },
      },
    });

    const perms = new Set<string>();
    const roleMap = new Map<number, RoleBriefDto>();
    for (const ur of userRoles) {
      const role = ur.role;
      if (!roleMap.has(role.id)) {
        roleMap.set(role.id, {
          id: role.id,
          code: role.code,
          name: role.name,
          description: role.description ?? null,
        });
      }
      for (const rm of role.menus) {
        if (rm.menu.permission) perms.add(rm.menu.permission);
      }
    }

    const roles = Array.from(roleMap.values()).sort((a, b) => {
      const levelDiff = (ROLE_LEVEL[b.code] ?? DEFAULT_ROLE_LEVEL) - (ROLE_LEVEL[a.code] ?? DEFAULT_ROLE_LEVEL);
      return levelDiff !== 0 ? levelDiff : a.id - b.id;
    });

    return {
      role: roles.length > 0 ? roles[0].code : null,
      roles,
      permissions: Array.from(perms),
    };
  }
}

export default new AuthService();
