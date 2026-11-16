/**
 * ============================================================
 * 配置参数校验 Schema（modules/config/config.schema.ts）
 * ============================================================
 */

import Joi from "joi";

/** 更新配置校验 */
export const updateConfigSchema = Joi.object({
  key: Joi.string().max(100).required(),
  value: Joi.string().max(2000).required(),
});

/** 超级设置批量保存：单项校验与单条接口一致，先整体校验再单事务写入 */
export const batchUpdateConfigSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        key: Joi.string().max(100).required(),
        value: Joi.string().max(2000).allow("").required(),
      })
    )
    .min(1)
    .max(50)
    .required(),
});
