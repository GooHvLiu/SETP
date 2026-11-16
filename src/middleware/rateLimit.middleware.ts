/**
 * ============================================================
 * 限流中间件（middleware/rateLimit.middleware.ts）
 * ------------------------------------------------------------
 * 分级限流：
 *   - rateLimitMiddleware：全局基础限流（默认 300 req / 15 min / IP）
 *   - loginRateLimitMiddleware：登录等敏感接口严格限流（默认 10 req / 1 min / IP）
 * 配合错误码 TOO_MANY_REQUESTS 返回统一格式。
 *
 * 计数使用主库持久化 store（SQLite/MySQL），同一窗口内多实例共享；
 * 不再使用 express-rate-limit 默认内存 store。模板不新增 Redis 依赖，
 * 以现有 Prisma 连接换取跨进程计数，部署侧如需更高吞吐可替换为 Redis store。
 * ============================================================
 */

import rateLimit from "express-rate-limit";
import env from "../config/env.schema";
import { ERROR_CODE } from "../constants/errorCode";
import { PrismaRateLimitStore } from "./rateLimitStore";

/** 限流触发时统一走 res.error，HTTP 429 */
function onLimitReached(_req: unknown, res: any): void {
  res.error(ERROR_CODE.TOO_MANY_REQUESTS);
}

/** 创建限流器（生产与测试共用同一 handler，避免测试绕过真实响应结构） */
export function createRateLimiter(options: { windowMs: number; max: number }) {
  // 不同限流器共用一张计数表，key 必须带稳定命名空间，避免全局/登录额度互相污染
  const keyPrefix = `${options.windowMs}:${options.max}`;
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new PrismaRateLimitStore(),
    keyGenerator: (req) => `${keyPrefix}:${req.ip}`,
    handler: onLimitReached,
  });
}

/** 全局基础限流（所有 /api 请求） */
export const rateLimitMiddleware = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MIN * 60 * 1000,
  max: env.RATE_LIMIT_MAX,
});

/** 登录/验证码等敏感接口严格限流 */
export const loginRateLimitMiddleware = createRateLimiter({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MIN * 60 * 1000,
  max: env.LOGIN_RATE_LIMIT_MAX,
});
