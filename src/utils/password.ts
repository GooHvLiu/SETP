/**
 * ============================================================
 * 密码工具（utils/password.ts）
 * ------------------------------------------------------------
 * 基于 bcryptjs 的密码哈希和校验
 * 安全规范：
 *   - 注册 / 改密时用 hashPassword
 *   - 登录时用 comparePassword 比对，禁止明文比对
 * ============================================================
 */

import bcrypt from "bcryptjs";
import appConfig from "../config/app.config";

/**
 * 密码哈希（注册 / 改密时用）
 * @param plainPassword 明文密码
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, appConfig.bcrypt.saltRounds);
}

/**
 * 密码校验（登录时用）
 * @param plainPassword 明文密码
 * @param hashed 数据库里存的哈希
 */
export async function comparePassword(plainPassword: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashed);
}

/**
 * 密码强度校验（弱口令拦截）
 * 规则：长度 8-32，且在「大写字母 / 小写字母 / 数字 / 特殊字符」四类中至少包含三类
 * 返回值只给布尔与内部标识，对外由 PASSWORD_WEAK + params.field 表达
 */
export function checkPasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (password.length < 8 || password.length > 32) {
    return { valid: false, reason: "PASSWORD_LENGTH" };
  }
  const classes = [/[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^a-zA-Z0-9]/.test(password)].filter(
    Boolean
  ).length;
  if (classes < 3) {
    return { valid: false, reason: "PASSWORD_CLASS" };
  }
  return { valid: true };
}
