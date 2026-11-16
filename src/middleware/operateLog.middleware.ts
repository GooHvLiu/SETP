/**
 * ============================================================
 * 操作日志中间件（middleware/operateLog.middleware.ts）
 * ------------------------------------------------------------
 * 覆盖 POST / PUT / PATCH / DELETE，成功与失败都记录：
 *   - 从 res.json 读取业务码 code，判断成功 / 失败 / 被拒
 *   - module 取 /api/v1/<module>，target 取路径末段
 *   - action 先按语义特判，再按 HTTP 方法兜底
 *   - 不解析请求体，不记录请求参数，避免敏感字段入库
 *
 * 跳过：/auth/login（登录流水由 auth controller 写，含失败原因）、
 *      /auth/logout、/auth/refresh、/notification/read*（已读操作太频繁）
 * ============================================================
 */

import { Request, Response, NextFunction } from "express";
import operateLogService from "../modules/operateLog/operateLog.service";

const SKIP_PATHS = ["/api/v1/auth/login", "/api/v1/auth/logout", "/api/v1/auth/refresh"];

function shouldSkip(path: string): boolean {
  if (SKIP_PATHS.includes(path)) return true;
  return path.startsWith("/api/v1/notification/read");
}

function resolveAction(method: string, path: string): string {
  const last = path.split("/").filter(Boolean).pop() || "";
  const keyword = last.toLowerCase();
  if (keyword === "approve") return "APPROVE";
  if (keyword === "reject") return "REJECT";
  if (keyword === "revoke") return "REVOKE";
  if (keyword === "cleanup") return "CLEANUP";
  if (keyword === "reindex") return "REINDEX";
  if (keyword === "test") return "TEST";
  if (method === "POST") return "CREATE";
  if (method === "PUT" || method === "PATCH") return "UPDATE";
  if (method === "DELETE") return "DELETE";
  return method;
}

export function operateLogMiddleware(req: Request, res: Response, next: NextFunction) {
  const method = req.method;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return next();
  }
  if (shouldSkip(req.path)) {
    return next();
  }

  // 包装 res.json，提前拿到统一响应体里的业务码与错误标识
  let payload: any;
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    payload = body;
    return originalJson(body);
  } as any;

  res.on("finish", async () => {
    try {
      const user = (req as any).user;
      if (!user?.userId) return;

      const path = req.path;
      const segments = path.split("/").filter(Boolean);
      const module = segments[2] || "unknown";
      const target = segments[segments.length - 1] || "";
      const action = resolveAction(method, path);

      const code = payload?.code;
      // 统一响应成功码为 200；兼容历史 0 / 无业务码的响应
      const success = code !== undefined ? code === 200 || code === 0 : res.statusCode < 400;
      const blocked = res.statusCode === 403 || code === 403 || code === 10104;
      const result = success ? "success" : blocked ? "blocked" : "failed";
      const reason = success ? "" : payload?.msg || `HTTP_${res.statusCode}`;

      await operateLogService.createLog({
        userId: user.userId,
        username: user.username || "",
        category: "operation",
        module,
        action,
        result,
        reason,
        target,
        description: `${method} ${path}`,
        ip: req.ip || "",
        userAgent: String(req.headers["user-agent"] || "").slice(0, 500),
        requestId: String(req.headers["x-request-id"] || "") || null,
      });
    } catch (e) {
      console.error("Operation Log Recording Failed:", e);
    }
  });

  next();
}
