/**
 * ============================================================
 * 角色参数校验 Schema（modules/role/role.schema.ts）
 * ============================================================
 */

import Joi from "joi";

/** 新增角色校验 */
export const createRoleSchema = Joi.object({
  code: Joi.string()
    .pattern(/^[a-zA-Z][a-zA-Z0-9_-]{1,49}$/)
    .required(), // 角色编码：字母开头，字母数字下划线中划线，2-50 位
  name: Joi.string().min(1).max(50).required(),
  description: Joi.string().max(200).optional().allow(""),
  status: Joi.number().valid(0, 1).optional(),
  menuIds: Joi.array().items(Joi.number().integer().min(1)).unique().optional(),
});

/** 更新角色校验 */
export const updateRoleSchema = Joi.object({
  name: Joi.string().min(1).max(50).optional(),
  description: Joi.string().max(200).optional().allow(""),
  status: Joi.number().valid(0, 1).optional(),
  menuIds: Joi.array().items(Joi.number().integer().min(1)).unique().optional(),
});
