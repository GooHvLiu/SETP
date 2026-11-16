/**
 * ============================================================
 * 业务错误（errors/BusinessError.ts）
 * ------------------------------------------------------------
 * service / controller 主动抛出，由全局错误中间件统一转换为响应体。
 * 只携带业务码、messageCode 与插值参数，不携带自然语言文案。
 * ============================================================
 */

import { CODE_TO_MSG } from "../constants/errorCode";

export type MessageParams = Record<string, string | number | boolean>;

export class BusinessError extends Error {
  code: number;
  params?: MessageParams;

  constructor(code: number, message?: string, params?: MessageParams) {
    super(message ?? CODE_TO_MSG[code] ?? "UNKNOWN_ERROR");
    this.name = "BusinessError";
    this.code = code;
    this.params = params;
  }
}
