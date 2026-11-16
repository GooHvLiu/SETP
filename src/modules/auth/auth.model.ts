/**
 * ============================================================
 * 认证模块类型定义（modules/auth/auth.model.ts）
 * ------------------------------------------------------------
 * TSOA 用 TS 类型自动生成 OpenAPI 文档
 * ============================================================
 */

import type { MenuTreeNode } from "../../utils/menuTree";

/** 角色简要信息（profile / 登录返回，用于展示，不用于权限判断） */
export interface RoleBriefDto {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

/** 登录返回的用户信息 */
export interface UserInfoDto {
  id: number;
  username: string;
  realName: string | null;
  status: number; // 0 禁用 / 1 正常 / 2 待审核
  createdAt: Date; // 注册时间
  lastLoginAt: Date | null; // 最后登录时间（登录成功后更新；从未登录为 null）
  mustChangePassword: boolean; // 管理员创建/重置或自助注册后为 true，改密成功后重新登录
  role: string | null; // 主角色 code（按 ROLE_LEVEL 取最高，仅展示）
  roles: RoleBriefDto[]; // 启用角色列表，按权限从高到低
  permissions: string[]; // 权限码数组（按钮级控制，所有启用角色并集）
  menus: MenuTreeNode[]; // 可见菜单树（前端动态路由）
}

/** 登录返回结果 */
export interface LoginResultDto {
  token: string; // Access Token（Authorization: Bearer <token>）
  refreshToken: string; // Refresh Token
  userInfo: UserInfoDto;
}

/** 自助注册返回结果 */
export interface RegisterResultDto {
  username: string;
  status: number; // 固定为 2（待管理员审核）
  approvalRequired: boolean; // 是否需要管理员审批后才能登录
}

/** 刷新令牌返回结果 */
export interface RefreshResultDto {
  token: string; // 新的 Access Token
  refreshToken: string; // 轮换后的新 Refresh Token（旧 token 立即失效）
}

/** 当前用户信息（Profile） */
export interface ProfileResultDto {
  id: number;
  username: string;
  realName: string | null;
  email: string | null;
  status: number; // 0 禁用 / 1 正常 / 2 待审核
  createdAt: Date; // 注册时间
  lastLoginAt: Date | null; // 最后登录时间（登录成功后更新；从未登录为 null）
  mustChangePassword: boolean;
  role: string | null; // 主角色 code（按 ROLE_LEVEL 取最高，仅展示）
  roles: RoleBriefDto[]; // 启用角色列表，按权限从高到低
  permissions: string[]; // 所有启用角色权限并集
  menus: MenuTreeNode[];
}
