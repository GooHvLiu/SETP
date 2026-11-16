/**
 * ============================================================
 * 异步路由包装器（utils/asyncHandler.ts）
 * ------------------------------------------------------------
 * Express 4 不自动捕获 async handler 的 rejection，
 * 手写路由中所有 async handler 必须用本包装器包裹，
 * 异常统一交给 errorHandler（否则会变成未处理 Promise rejection）。
 *
 * 用法：
 *   router.get("/list", asyncHandler(async (req, res) => { ... }));
 * ============================================================
 */

import { Request, Response, NextFunction, RequestHandler } from "express";

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default asyncHandler;
