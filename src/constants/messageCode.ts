/**
 * ============================================================
 * 消息代码常量（constants/messageCode.ts）
 * ------------------------------------------------------------
 * 所有返回给前端的英文消息代码都在这里统一管理
 * 前端根据这些代码做国际化映射，不直接显示英文
 *
 * 命名规则：
 *   SUCCESS_XXX        → 成功类消息
 *   NOTIFICATION_XXX   → 通知类消息
 *
 * 使用：BaseController 默认 msg
 * ============================================================
 */

export const MESSAGE_CODE = {
  // ==================== 通用成功 ====================
  SUCCESS: "SUCCESS",

  // ==================== 认证模块 ====================
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  REGISTER_SUCCESS: "REGISTER_SUCCESS",
  REGISTER_PENDING_APPROVAL: "REGISTER_PENDING_APPROVAL",
  LOGOUT_SUCCESS: "LOGOUT_SUCCESS",
  REFRESH_SUCCESS: "REFRESH_SUCCESS",
  PASSWORD_RESET_CODE_SENT: "PASSWORD_RESET_CODE_SENT",
  PASSWORD_RESET_SUCCESS: "PASSWORD_RESET_SUCCESS",

  // ==================== 通用 CRUD 成功 ====================
  CREATE_SUCCESS: "CREATE_SUCCESS",
  UPDATE_SUCCESS: "UPDATE_SUCCESS",
  DELETE_SUCCESS: "DELETE_SUCCESS",
  RESTORE_SUCCESS: "RESTORE_SUCCESS",
  BATCH_DELETE_SUCCESS: "BATCH_DELETE_SUCCESS",

  // ==================== 文件上传 ====================
  UPLOAD_SUCCESS: "UPLOAD_SUCCESS",

  // ==================== 验证码 ====================
  CAPTCHA_GENERATED: "CAPTCHA_GENERATED",
} as const;

/** 消息代码类型 */
export type MessageCodeType = (typeof MESSAGE_CODE)[keyof typeof MESSAGE_CODE];

/**
 * 消息码中文说明（与 MESSAGE_CODE 一一对应）
 * 供 Swagger 文档第 5 节动态生成表格；
 * 新增消息码时：在 MESSAGE_CODE 加一行 + 在这里补一行中文说明即可
 */
export const MESSAGE_DESC: Record<string, string> = {
  SUCCESS: "通用成功",
  LOGIN_SUCCESS: "登录成功",
  REGISTER_SUCCESS: "注册成功",
  REGISTER_PENDING_APPROVAL: "注册成功，待管理员审核",
  LOGOUT_SUCCESS: "退出成功",
  REFRESH_SUCCESS: "刷新成功",
  PASSWORD_RESET_CODE_SENT: "重置密码验证码已发送",
  PASSWORD_RESET_SUCCESS: "密码重置成功",
  CREATE_SUCCESS: "创建成功",
  UPDATE_SUCCESS: "更新成功",
  DELETE_SUCCESS: "删除成功",
  RESTORE_SUCCESS: "恢复成功",
  BATCH_DELETE_SUCCESS: "批量删除成功",
  UPLOAD_SUCCESS: "上传成功",
  CAPTCHA_GENERATED: "验证码已生成",
};
