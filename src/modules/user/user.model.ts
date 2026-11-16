/**
 * ============================================================
 * 用户模块类型定义（modules/user/user.model.ts）
 * ------------------------------------------------------------
 * TSOA 用 TS 类型自动生成 OpenAPI 文档与参数校验
 * ============================================================
 */

/** 新增用户请求体 */
export interface CreateUserBody {
  username: string;
  password: string;
  realName?: string;
  email: string; // 创建用户必填（DB NOT NULL）
  roleCodes?: string[]; // 角色编码列表（RBAC）
}

/** 更新用户请求体 */
export interface UpdateUserBody {
  username?: string; // 修改用户名（变更时查重，排除自身）
  realName?: string;
  email?: string;
  status?: number;
  password?: string;
  roleCodes?: string[];
}

/** 用户记录（详情/新增返回，不含密码哈希） */
export interface UserDto {
  id: number;
  username: string;
  realName: string | null;
  email: string | null;
  status: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: string[]; // 角色编码列表
}

/** 批量删除用户请求体 */
export interface BatchDeleteBody {
  ids: number[]; // 用户 id 列表（1~100）
}

/** 批量删除返回 */
export interface BatchDeleteResult {
  deleted: number; // 实际删除数量
}

/** 用户分页列表 */
export interface UserListResult {
  list: UserDto[];
  total: number;
  page: number;
  pageSize: number;
}
