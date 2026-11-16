/**
 * ============================================================
 * 角色常量（constants/role.ts）
 * ------------------------------------------------------------
 * 所有角色定义统一在这里，不要在代码里硬编码字符串
 * 注意：RBAC 后角色数据存库（roles 表），这里的常量用于
 *       seed 脚本、以及代码里引用角色 code 的场景
 *
 * 使用：RBAC 种子 / 权限
 * ============================================================
 */

export const ROLE = {
  /** 系统管理员：全部业务权限（不含系统结构维护，如角色/权限/菜单/字典） */
  ADMIN: "admin",

  /** 操作员：只能管业务，不能管用户/配置 */
  OPERATOR: "operator",

  /** 只读用户：只能看，不能改 */
  VIEWER: "viewer",

  /** 超级管理员：仅设计者维护，全部权限（含字典/角色/权限/菜单管理） */
  SUPER_ADMIN: "superAdmin",
} as const;

/** 角色类型 */
export type RoleType = (typeof ROLE)[keyof typeof ROLE];

/**
 * 角色中文说明（与 ROLE 一一对应）
 * 供 Swagger 文档第 7 节动态生成表格；
 * 新增角色时：在 ROLE 加一行 + 在这里补一行中文说明即可
 */
export const ROLE_DESC: Record<string, string> = {
  ADMIN: "系统管理员：全部业务权限",
  OPERATOR: "操作员：只能管业务，不能管用户/配置",
  VIEWER: "只读用户：只能看，不能改",
  SUPER_ADMIN: "超级管理员：仅设计者维护，全部权限（含字典/角色/权限/菜单管理）",
};

/**
 * 角色层级权重（数值越大权限越高）
 * 用户管理接口按此判断“只能操作比自己低级的账号”：
 *   - 同角色、同级别、更高级别一律拒绝
 *   - 自定义角色暂按最低级处理，后续可在 roles 表加 level 字段扩展
 */
export const ROLE_LEVEL: Record<string, number> = {
  [ROLE.SUPER_ADMIN]: 100,
  [ROLE.ADMIN]: 50,
  [ROLE.OPERATOR]: 20,
  [ROLE.VIEWER]: 10,
};

/** 未登记角色的默认层级（自定义角色） */
export const DEFAULT_ROLE_LEVEL = 0;

/** 超级管理员用户名（seed 固定写死；账号对业务角色隐藏并保护，禁止注册/创建同名） */
export const SUPER_ADMIN_USERNAME = "superAdmin";

export default ROLE;
