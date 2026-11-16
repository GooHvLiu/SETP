/**
 * ============================================================
 * 帮助中心参数校验（modules/help/help.schema.ts）
 * ------------------------------------------------------------
 * Joi 校验：与 dict 模块同一风格，controller 内校验失败走 failJoi
 * ============================================================
 */

import Joi from "joi";

/** 文档树查询：locale 可选（未传时读 system_configs.default_locale） */
export const treeQuerySchema = Joi.object({
  locale: Joi.string().min(2).max(20).optional(),
});

/** 文章查询：locale 可选、path 必填 */
export const articleQuerySchema = Joi.object({
  locale: Joi.string().min(2).max(20).optional(),
  path: Joi.string().min(1).max(500).required(),
});

/** AI 对话请求：question 必填、history 最多 20 轮 */
export const chatBodySchema = Joi.object({
  question: Joi.string().min(1).max(2000).required(),
  locale: Joi.string().min(2).max(20).optional(),
  history: Joi.array()
    .items(
      Joi.object({
        role: Joi.string().valid("user", "assistant").required(),
        content: Joi.string().min(1).max(2000).required(),
      })
    )
    .max(20)
    .optional(),
});
