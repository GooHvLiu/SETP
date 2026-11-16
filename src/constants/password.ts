/**
 * ============================================================
 * 密码常量（constants/password.ts）
 * ------------------------------------------------------------
 * 模板默认口令集中定义。
 * 这些值只用于模板初始化与本地联调，不是生产安全配置；
 * 正式项目必须在 .env 或本文件中替换后再部署。
 * ============================================================
 */

/** 模板默认管理员用户名 */
export const TEMPLATE_ADMIN_USERNAME = "admin";

/** 模板默认管理员密码（seed 初始化用） */
export const TEMPLATE_ADMIN_PASSWORD = "123456";

/** 模板默认超级管理员密码（seed 初始化用） */
export const TEMPLATE_SUPER_ADMIN_PASSWORD = "superAdmin123456@";

/** 模板默认重置密码（管理员重置用户后使用，登录一次即强制改密） */
export const TEMPLATE_ADMIN_RESET_PASSWORD = "123456";
