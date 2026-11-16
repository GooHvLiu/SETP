/**
 * ============================================================
 * 用户参数校验 Schema（modules/user/user.schema.ts）
 * ------------------------------------------------------------
 * Joi 校验用户管理的请求体与查询参数
 * ============================================================
 */

import Joi from "joi";

/** 列表查询参数校验 */
export const listUserSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(10),
  username: Joi.string().max(50).optional(),
  realName: Joi.string().max(50).optional(),
  status: Joi.number().valid(0, 1, 2).optional(),
});

/** 新增用户校验 */
export const createUserSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(8).max(32).required(),
  realName: Joi.string().max(50).optional(),
  email: Joi.string().email().max(100).required(), // 创建用户必填（DB NOT NULL）
  roleCodes: Joi.array().items(Joi.string()).min(1).optional(),
});

/** 更新用户校验 */
export const updateUserSchema = Joi.object({
  username: Joi.string().min(3).max(50).optional(),
  realName: Joi.string().max(50).optional(),
  email: Joi.string().email().max(100).optional(),
  status: Joi.number().valid(0, 1).optional(),
  password: Joi.string().min(8).max(32).optional(),
  roleCodes: Joi.array().items(Joi.string()).min(1).optional(),
});

/** 批量删除用户校验 */
export const batchDeleteSchema = Joi.object({
  ids: Joi.array().items(Joi.number().integer().min(1)).min(1).max(100).required(),
});
