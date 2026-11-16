/**
 * ============================================================
 * 统一响应格式中间件（middleware/response.middleware.ts）
 * ------------------------------------------------------------
 * 响应体固定：
 *   { code, msg, params?, data, timestamp, requestId? }
 *
 * 约定：
 *   1. msg 永远是 messageCode，不是自然语言；中文由前端 i18n 映射
 *   2. params 只放插值参数（字段名、长度、数量等），不拼接文案
 *   3. HTTP 状态码按语义返回，由 constants/httpStatus.ts 统一映射
 *   4. requestId 由 pino-http 生成，所有出口自动补齐
 * ============================================================
 */

import { Request, Response, NextFunction } from "express";
import { ERROR_CODE, CODE_TO_MSG } from "../constants/errorCode";
import { ERROR_MAP } from "../constants/errorMap";
import { httpStatusForCode } from "../constants/httpStatus";
import { MESSAGE_CODE } from "../constants/messageCode";
import { STATUS_CODE } from "../constants/statusCode";

type MessageParams = Record<string, string | number | boolean>;

/** 统一响应中间件 */
export default function responseMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req as Request & { id?: string }).id;

  // 给所有 res.json 出口补 requestId，覆盖 controller return、手写路由、限流与错误处理
  const originalJson = res.json.bind(res);
  (res as Response & { json: (body: unknown) => Response }).json = (body: unknown): Response => {
    if (body && typeof body === "object" && "code" in body) {
      const payload = body as Record<string, unknown>;
      if (requestId && !payload.requestId) payload.requestId = requestId;
    }
    return originalJson(body);
  };

  /** 成功响应：HTTP 200 */
  res.success = (data: unknown = null, msg: string = MESSAGE_CODE.SUCCESS, params?: MessageParams): void => {
    res.status(STATUS_CODE.OK).json({
      code: ERROR_CODE.SUCCESS,
      msg,
      ...(params ? { params } : {}),
      data,
      timestamp: Date.now(),
    });
  };

  /** 失败响应：支持 res.error("USER_NOT_EXIST") 或 res.error(ERROR_CODE.UNAUTHORIZED) */
  res.error = (error: string | number, code?: number, params?: MessageParams): void => {
    let errorCode: number;
    let msg: string;

    if (typeof error === "number") {
      errorCode = error;
      msg = CODE_TO_MSG[error] ?? "UNKNOWN_ERROR";
    } else {
      msg = error;
      errorCode = code ?? ERROR_MAP[error] ?? ERROR_CODE.PARAM_ERROR;
    }

    res.status(httpStatusForCode(errorCode)).json({
      code: errorCode,
      msg,
      ...(params ? { params } : {}),
      data: null,
      timestamp: Date.now(),
    });
  };

  next();
}
