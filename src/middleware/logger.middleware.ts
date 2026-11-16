/**
 * ============================================================
 * Pino 请求日志中间件（middleware/logger.middleware.ts）
 * ------------------------------------------------------------
 * 基于 pino-http，自动为每个请求生成结构化 JSON 日志：
 *   - method / url / statusCode / responseTime / ip
 *   - reqId：每个请求的唯一 ID（贯穿日志，便于排查链路）
 * 替代原 console.log 文本日志
 * ============================================================
 */

import { pinoHttp } from "pino-http";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

/** pino-http 实例（自动挂 req.log / res.log） */
const httpLogger = pinoHttp({
  logger,

  // 自定义请求 ID 生成：优先沿用外部链路 ID（x-request-id），否则生成新 ID
  // 注意：返回值类型必须是 string | number（ReqId），不能返回 undefined
  genReqId: (req) => {
    const id = req.headers["x-request-id"];
    if (typeof id === "string" && id.length > 0) {
      return id;
    }
    return crypto.randomUUID();
  },

  // 统一日志级别：5xx/异常 error，4xx warn，其余 info
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});

export default function loggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  httpLogger(req, res, () => {
    // 把链路 ID 回写响应头，前端/网关可直接拿到同一条 requestId
    if (req.id) res.setHeader("X-Request-ID", String(req.id));
    next();
  });
}
