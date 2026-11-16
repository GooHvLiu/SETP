/**
 * ============================================================
 * Controller 基类（base/BaseController.ts）
 * ------------------------------------------------------------
 * TSOA 版本所有 Controller 继承此类。
 *
 * ★ 重要（TSOA 运行时机制）：
 *   本 TSOA 版本不会把 Express 的 req / res 注入到 this.req / this.res。
 *   因此统一采用「return 模式」：
 *     1. 成功响应：方法里 return this.ok(data, msg)
 *     2. 参数校验失败：return this.failJoi(error)  —— Joi 错误统一转 PARAM_INVALID + params.field
 *     3. 主动失败：return this.fail(ERROR_CODE.XXX) —— msg 自动从 CODE_TO_MSG 补全，无需手写
 *     4. 业务错误：throw new Error("XXX")，由全局 errorHandler 处理
 *     5. 需要读取请求对象时：方法参数加 @Request() request: ExRequest
 *
 * ★ 国际化返回规范（本项目核心约定）：
 *   - 响应体固定 { code, msg, params?, data, timestamp, requestId? }
 *   - msg 永远是「字符串代码标识」（如 SUCCESS / USER_NOT_EXIST / PARAM_INVALID），
 *     需要插值的内容放 params（如 { field: "username" }），前端按 msg + params 做 i18n
 *   - code（数字）与 msg（标识）的双向映射集中维护在 constants/errorCode.ts，
 *     fail() 不传 msg 时自动补全，杜绝手写字符串散落与写错
 * ============================================================
 */

import { Controller } from "@tsoa/runtime";
import { ERROR_CODE, CODE_TO_MSG } from "../constants/errorCode";
import { httpStatusForCode } from "../constants/httpStatus";
import { MESSAGE_CODE } from "../constants/messageCode";
import { STATUS_CODE } from "../constants/statusCode";
import { ApiResponse } from "../types";

export class BaseController extends Controller {
  /**
   * 成功响应构造器
   * 用法：return this.ok(result) 或 return this.ok(result, MESSAGE_CODE.CREATE_SUCCESS)
   * 不传 msg 时默认 SUCCESS
   */
  protected ok<T = any>(data: T, msg: string = MESSAGE_CODE.SUCCESS, params?: Record<string, string | number | boolean>): ApiResponse<T> {
    this.setStatus(STATUS_CODE.OK);
    return {
      code: ERROR_CODE.SUCCESS,
      msg,
      ...(params ? { params } : {}),
      data,
      timestamp: Date.now(),
    };
  }

  /**
   * 失败响应构造器（参数校验等主动拦截场景）
   * 用法：return this.fail(ERROR_CODE.UNAUTHORIZED)
   * msg 不传时自动从 CODE_TO_MSG 反查标识；HTTP 状态由 httpStatus.ts 统一映射
   */
  protected fail(code: number, msg?: string, params?: Record<string, string | number | boolean>): ApiResponse<never> {
    this.setStatus(httpStatusForCode(code));
    return {
      code,
      msg: msg ?? CODE_TO_MSG[code] ?? "UNKNOWN_ERROR",
      ...(params ? { params } : {}),
      data: null as never,
      timestamp: Date.now(),
    };
  }

  /**
   * 带业务数据的失败响应
   * 用于「请求已执行但结果失败」的场景（如运维任务执行失败，仍需返回执行记录）
   */
  protected failWithData<T>(code: number, data: T, msg?: string, params?: Record<string, string | number | boolean>): ApiResponse<T> {
    this.setStatus(httpStatusForCode(code));
    return {
      code,
      msg: msg ?? CODE_TO_MSG[code] ?? "UNKNOWN_ERROR",
      ...(params ? { params } : {}),
      data,
      timestamp: Date.now(),
    };
  }

  /**
   * Joi 参数校验失败统一出口
   * 返回 PARAM_INVALID + params.field，前端 i18n 用字段名渲染提示
   */
  protected failJoi(error: { details?: Array<{ path?: Array<string | number> }> }): ApiResponse<never> {
    const field = error?.details?.[0]?.path?.join(".") ?? "param";
    return this.fail(ERROR_CODE.PARAM_INVALID, "PARAM_INVALID", { field });
  }
}
