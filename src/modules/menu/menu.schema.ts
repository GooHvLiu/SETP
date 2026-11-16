/**
 * ============================================================
 * 菜单参数校验 Schema（modules/menu/menu.schema.ts）
 * ============================================================
 */

import Joi from "joi";

/** 新增菜单校验 */
export const createMenuSchema = Joi.object({
  parentId: Joi.number().integer().min(0).optional(),
  name: Joi.string().min(1).max(50).required(),
  type: Joi.string().valid("DIR", "MENU", "BUTTON").required(),
  path: Joi.string().max(200).optional().allow(""),
  component: Joi.string().max(200).optional().allow(""),
  icon: Joi.string().max(100).optional().allow(""),
  // 菜单分组标识：DIR/MENU 可选；空=前端不渲染（后端不强制类型，由配置人员控制）
  menu_group: Joi.string().max(50).optional().allow(""),
  permission: Joi.string().max(100).optional().allow(""),
  sort: Joi.number().integer().min(0).optional(),
  status: Joi.number().valid(0, 1).optional(),
  visible: Joi.number().valid(0, 1).optional(),
});

/** 更新菜单校验 */
export const updateMenuSchema = Joi.object({
  parentId: Joi.number().integer().min(0).optional(),
  name: Joi.string().min(1).max(50).optional(),
  type: Joi.string().valid("DIR", "MENU", "BUTTON").optional(),
  path: Joi.string().max(200).optional().allow(""),
  component: Joi.string().max(200).optional().allow(""),
  icon: Joi.string().max(100).optional().allow(""),
  menu_group: Joi.string().max(50).optional().allow(""),
  permission: Joi.string().max(100).optional().allow(""),
  sort: Joi.number().integer().min(0).optional(),
  status: Joi.number().valid(0, 1).optional(),
  visible: Joi.number().valid(0, 1).optional(),
});
