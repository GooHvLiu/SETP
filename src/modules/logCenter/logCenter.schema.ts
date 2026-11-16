/**
 * ============================================================
 * 日志中心参数校验（modules/logCenter/logCenter.schema.ts）
 * ============================================================
 */

import Joi from "joi";
import { LOG_CATEGORY, LOG_RESULT } from "@src/constants/log";

const categories = Object.values(LOG_CATEGORY);
const results = Object.values(LOG_RESULT);

/** 日志列表公共筛选字段（全局日志中心与个人日志共用） */
const listFilterFields = {
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  category: Joi.string()
    .valid(...categories)
    .optional(),
  module: Joi.string().max(100).optional(),
  action: Joi.string().max(50).optional(),
  result: Joi.string()
    .valid(...results)
    .optional(),
  keyword: Joi.string().max(100).optional(),
  from: Joi.string().isoDate().optional(),
  to: Joi.string().isoDate().optional(),
};

/** 全局日志中心：支持按用户名模糊筛选 */
export const logListSchema = Joi.object({
  ...listFilterFields,
  username: Joi.string().max(100).optional(),
});

/** 个人日志：不接受 username，查询范围只能由服务端从登录主体确定 */
export const myLogListSchema = Joi.object(listFilterFields);

export const logSummarySchema = Joi.object({
  range: Joi.string().valid("24h", "7d", "30d").default("24h"),
});

export const logCleanupSchema = Joi.object({
  beforeDays: Joi.number().integer().min(1).max(3650).optional(),
  confirm: Joi.string().required(),
});
