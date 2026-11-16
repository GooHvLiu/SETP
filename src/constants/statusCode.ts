/**
 * ============================================================
 * HTTP 状态码常量（constants/statusCode.ts）
 * ------------------------------------------------------------
 * 统一 HTTP 状态码，避免魔法数字
 * 使用：response 中间件、限流
 * ============================================================
 */

export const STATUS_CODE = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export type StatusCodeType = (typeof STATUS_CODE)[keyof typeof STATUS_CODE];

/**
 * HTTP 状态码中文说明（与 STATUS_CODE 一一对应）
 * 供 Swagger 文档第 6 节动态生成表格；
 * 新增状态码时：在 STATUS_CODE 加一行 + 在这里补一行中文说明即可
 */
export const STATUS_DESC: Record<string, string> = {
  OK: "成功",
  CREATED: "已创建",
  NO_CONTENT: "无内容",
  BAD_REQUEST: "请求参数错误",
  UNAUTHORIZED: "未认证",
  FORBIDDEN: "禁止访问",
  NOT_FOUND: "资源不存在",
  CONFLICT: "资源状态冲突",
  PAYLOAD_TOO_LARGE: "请求体过大",
  UNSUPPORTED_MEDIA_TYPE: "不支持的媒体类型",
  UNPROCESSABLE_ENTITY: "参数语义不合法",
  TOO_MANY_REQUESTS: "请求过多",
  INTERNAL_ERROR: "服务器内部错误",
  BAD_GATEWAY: "上游服务错误",
  SERVICE_UNAVAILABLE: "服务暂不可用",
  GATEWAY_TIMEOUT: "上游服务超时",
};

export default STATUS_CODE;
