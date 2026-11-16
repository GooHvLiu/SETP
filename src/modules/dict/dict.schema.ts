/**
 * ============================================================
 * 数据字典参数校验 Schema（modules/dict/dict.schema.ts）
 * ============================================================
 */

import Joi from "joi";

/** 新增字典类型校验 */
export const createTypeSchema = Joi.object({
  typeCode: Joi.string().max(100).required(),
  typeName: Joi.string().max(100).required(),
  remark: Joi.string().max(200).optional(),
});

/** 更新字典类型校验 */
export const updateTypeSchema = Joi.object({
  typeName: Joi.string().max(100).optional(),
  remark: Joi.string().max(200).optional(),
  status: Joi.number().valid(0, 1).optional(),
});

/** 新增字典项校验 */
export const createDataSchema = Joi.object({
  dictTypeId: Joi.number().integer().required(),
  label: Joi.string().max(100).required(),
  value: Joi.string().max(100).required(),
  sort: Joi.number().integer().min(0).optional(),
});

/** 更新字典项校验 */
export const updateDataSchema = Joi.object({
  label: Joi.string().max(100).optional(),
  value: Joi.string().max(100).optional(),
  sort: Joi.number().integer().min(0).optional(),
  status: Joi.number().valid(0, 1).optional(),
});

/** 管理端字典类型列表查询校验 */
export const listTypeSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(10),
  keyword: Joi.string().trim().max(50).allow("").optional(),
  status: Joi.number().valid(0, 1).optional(),
});

/** 管理端字典项列表查询校验 */
export const listDataSchema = Joi.object({
  typeId: Joi.number().integer().required(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(10),
  keyword: Joi.string().trim().max(50).allow("").optional(),
  status: Joi.number().valid(0, 1).optional(),
});
