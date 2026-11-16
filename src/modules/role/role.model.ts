/**
 * ============================================================
 * 角色模块类型定义（modules/role/role.model.ts）
 * ------------------------------------------------------------
 * TSOA 用 TS 类型自动生成 OpenAPI 文档与参数校验
 * ============================================================
 */

/** 新增角色请求体 */
export interface CreateRoleBody {
  code: string; // 角色编码，如 operator
  name: string; // 角色名称，如 操作员
  description?: string;
  status?: number; // 1 启用 0 禁用
  menuIds?: number[]; // 绑定的菜单 id 列表（空则不绑定）
}

/** 更新角色请求体 */
export interface UpdateRoleBody {
  name?: string;
  description?: string;
  status?: number;
  menuIds?: number[]; // 传了则整体重建绑定
}

/** 角色详情（列表/详情/新增返回，含绑定菜单 id 与权限码） */
export interface RoleDto {
  id: number;
  code: string;
  name: string;
  description: string | null;
  status: number;
  createdAt: Date;
  updatedAt: Date;
  menuIds: number[]; // 绑定的菜单 id
  permissions: string[]; // 该角色全部权限码
}
