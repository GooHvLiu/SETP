/**
 * ============================================================
 * 全局错误处理中间件（middleware/error.middleware.ts）
 * ------------------------------------------------------------
 * 捕获所有路由抛出的异常，统一返回标准格式：
 *   { code, msg, params?, data, timestamp, requestId? }
 *
 * 约定：
 *   1. msg 是 messageCode，不是自然语言
 *   2. HTTP 状态码按语义返回，由 constants/httpStatus.ts 统一映射
 *   3. 所有出口都走 sendError，禁止各写各的 res.json
 * ============================================================
 */

import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import logger from "../utils/logger";
import { ERROR_CODE, CODE_TO_MSG } from "../constants/errorCode";
import { ERROR_MAP } from "../constants/errorMap";
import { httpStatusForCode } from "../constants/httpStatus";
import { BusinessError, MessageParams } from "../errors/BusinessError";

export { BusinessError };

/** 组装统一错误响应 */
function buildErrorRes(code: number, msg?: string, params?: MessageParams, requestId?: string) {
  return {
    code,
    msg: msg ?? CODE_TO_MSG[code] ?? "UNKNOWN_ERROR",
    ...(params ? { params } : {}),
    data: null,
    timestamp: Date.now(),
    ...(requestId ? { requestId } : {}),
  };
}

/** 统一错误出口：设置 HTTP 状态码 + 标准响应体 */
function sendError(req: Request, res: Response, code: number, msg?: string, params?: MessageParams): void {
  res.status(httpStatusForCode(code)).json(buildErrorRes(code, msg, params, (req as Request & { id?: string }).id));
}

/**
 * 全局错误处理中间件
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  logger.error(
    {
      method: req.method,
      url: req.url,
      errName: err?.name,
      errCode: err?.code,
      stack: process.env.NODE_ENV !== "production" ? err?.stack : undefined,
    },
    `[ERROR] ${req.method} ${req.url} - ${err?.message}`
  );

  // 1. 业务错误类（主动 throw new BusinessError，保留 code 与 params）
  if (err instanceof BusinessError) {
    sendError(req, res, err.code, err.message, err.params);
    return;
  }

  // 2. 业务错误（throw new Error("XXX")，由 ERROR_MAP 识别标识）
  if (err?.message && ERROR_MAP[err.message]) {
    sendError(req, res, ERROR_MAP[err.message]);
    return;
  }

  // 3. TSOA 鉴权错误：先按 name 区分，再把 status=401 作为兜底
  if (err?.name === "Forbidden" || err?.status === 403) {
    sendError(req, res, ERROR_CODE.PERMISSION_DENIED);
    return;
  }

  if (err?.name === "TokenExpiredError") {
    sendError(req, res, ERROR_CODE.TOKEN_EXPIRED);
    return;
  }
  if (err?.name === "JsonWebTokenError" || err?.name === "NotBeforeError") {
    sendError(req, res, ERROR_CODE.TOKEN_INVALID);
    return;
  }
  if (err?.name === "PasswordChangeRequired" || err?.message === "PASSWORD_CHANGE_REQUIRED") {
    sendError(req, res, ERROR_CODE.PASSWORD_CHANGE_REQUIRED);
    return;
  }
  if (err?.name === "Unauthorized" || err?.status === 401) {
    sendError(req, res, ERROR_CODE.UNAUTHORIZED);
    return;
  }

  // 4. TSOA 参数校验错误
  if (err?.name === "ValidateError" && err.fields) {
    const field = Object.keys(err.fields)[0] ?? "param";
    sendError(req, res, ERROR_CODE.PARAM_INVALID, "PARAM_INVALID", { field });
    return;
  }

  // 5. Joi 校验错误
  if (err?.name === "ValidationError" && err.details) {
    const field = err.details[0]?.path?.join(".") ?? "param";
    sendError(req, res, ERROR_CODE.PARAM_INVALID, "PARAM_INVALID", { field });
    return;
  }

  // 6. Multer 上传错误
  if (err?.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      sendError(req, res, ERROR_CODE.FILE_TOO_LARGE);
      return;
    }
    sendError(req, res, ERROR_CODE.FILE_UPLOAD_FAIL);
    return;
  }

  // 7. Prisma 数据库错误
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      // 唯一约束冲突：params 带具体字段，前端按字段渲染，不再一律提示“用户已存在”
      const target = Array.isArray(err.meta?.target) ? (err.meta?.target as string[]).join(",") : String(err.meta?.target ?? "");
      sendError(req, res, ERROR_CODE.DATA_CONFLICT, "DATA_CONFLICT", {
        field: target || "unknown",
      });
      return;
    }
    if (err.code === "P2025") {
      sendError(req, res, ERROR_CODE.NOT_FOUND);
      return;
    }
    sendError(req, res, ERROR_CODE.DATABASE_ERROR);
    return;
  }

  // 8. 语法错误 / 类型错误（代码 bug）
  if (err instanceof SyntaxError || err instanceof TypeError) {
    sendError(req, res, ERROR_CODE.SYSTEM_ERROR);
    return;
  }

  // 9. 未知错误（兜底）
  sendError(req, res, ERROR_CODE.UNKNOWN_ERROR);
}

/**
 * 404 处理中间件
 */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(req, res, ERROR_CODE.NOT_FOUND);
}
