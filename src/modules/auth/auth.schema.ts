/**
 * ============================================================
 * 认证参数校验 Schema（modules/auth/auth.schema.ts）
 * ------------------------------------------------------------
 * Joi 校验登录 / 注册 / 刷新请求体
 * 密码强度规则与 utils/password.ts 保持一致
 * ============================================================
 */

import Joi from "joi";

/** 登录请求体校验（密码只要求非空，长度限制留给注册/改密） */
export const loginSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(1).max(64).required(),
  captchaId: Joi.string().uuid().required(),
  captchaCode: Joi.string().length(4).required(),
});

/** 注册请求体校验 */
export const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(8).max(32).required(), // 强度再在 service 校验
  email: Joi.string().email().max(100).required(), // 注册必填（DB NOT NULL）
  realName: Joi.string().max(50).optional(),
});

/** 刷新令牌请求体校验 */
export const refreshSchema = Joi.object({
  refreshToken: Joi.string().min(20).required(),
});

/** 申请重置密码：用户名 + 邮箱双匹配（User.email 无唯一约束，单邮箱可能命中多账号） */
export const requestPasswordResetSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).required(),
  email: Joi.string().trim().lowercase().email().max(100).required(),
  captchaId: Joi.string().uuid().required(),
  captchaCode: Joi.string().length(4).required(),
});

/** 提交重置密码：验证码固定 6 位数字，新密码长度与注册一致 */
export const resetPasswordSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).required(),
  email: Joi.string().trim().lowercase().email().max(100).required(),
  code: Joi.string()
    .pattern(/^\d{6}$/)
    .required(),
  newPassword: Joi.string().min(8).max(32).required(),
});
/** 修改密码：必须提供旧密码；新密码长度与注册一致 */
export const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().min(1).max(64).required(),
  newPassword: Joi.string().min(8).max(32).required(),
});
