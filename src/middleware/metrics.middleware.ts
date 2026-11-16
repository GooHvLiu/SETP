/**
 * ============================================================
 * 请求指标采集中间件（middleware/metrics.middleware.ts）
 * ------------------------------------------------------------
 * 在响应结束时记录一次请求：状态码 + 耗时。
 * 只做统计，不做拦截；异常由 metricsService 内部吞掉，
 * 保证统计故障不影响正常请求。
 * ============================================================
 */

import { NextFunction, Request, Response } from "express";
import metricsService from "../modules/metrics/metrics.service";

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    try {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      metricsService.recordRequest(res.statusCode, durationMs);
    } catch {
      // 统计失败不影响业务响应
    }
  });

  next();
}

export default metricsMiddleware;
