/**
 * 邮件服务入参校验（modules/mail/mail.schema.ts）
 */

import Joi from "joi";

/** 测试接口：不传 mode 时默认 full（发送 + IMAP 回读）；to 不传时发给发件邮箱自己 */
export const mailTestSchema = Joi.object({
  mode: Joi.string().valid("full", "send", "verify").default("full"),
  to: Joi.string().email().max(254).optional(),
});

/** 邮件日志列表：默认最近 20 条，可按 template 过滤 */
export const mailLogListSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  template: Joi.string().max(64).optional(),
});
