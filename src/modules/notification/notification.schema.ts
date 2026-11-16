/**
 * ============================================================
 * 通知中心参数校验（modules/notification/notification.schema.ts）
 * ============================================================
 */

import Joi from "joi";
import { NOTIFICATION_CATEGORY, NOTIFICATION_TYPE } from "@src/constants/notification";

const categories = Object.values(NOTIFICATION_CATEGORY);
const types = Object.values(NOTIFICATION_TYPE);

/** 用户侧列表查询 */
export const notificationListSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(10),
  isRead: Joi.number().valid(0, 1).optional(),
  category: Joi.string()
    .valid(...categories)
    .optional(),
  type: Joi.string()
    .valid(...types)
    .optional(),
});

/** 管理员通知批次列表 */
export const notificationBatchListSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(10),
  category: Joi.string()
    .valid(...categories)
    .optional(),
  type: Joi.string()
    .valid(...types)
    .optional(),
  source: Joi.string().max(100).optional(),
  keyword: Joi.string().max(100).optional(),
});

/** 批次详情分页 */
export const notificationBatchDetailSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

/** 管理员发送 */
export const adminSendNotificationSchema = Joi.object({
  title: Joi.string().max(100).required(),
  content: Joi.string().max(5000).required(),
  category: Joi.string()
    .valid(...categories)
    .optional(),
  type: Joi.string()
    .valid(...types)
    .optional(),
  audience: Joi.object({
    type: Joi.string().valid("all", "role", "user").required(),
    roleCodes: Joi.array().items(Joi.string().max(50)).min(1).when("type", { is: "role", then: Joi.required(), otherwise: Joi.optional() }),
    userIds: Joi.array()
      .items(Joi.number().integer().positive())
      .min(1)
      .when("type", { is: "user", then: Joi.required(), otherwise: Joi.optional() }),
  }).required(),
  link: Joi.string().allow("").max(500).optional(),
  sendEmail: Joi.boolean().optional(),
});
