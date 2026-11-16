/**
 * ============================================================
 * 敏感配置加解密（utils/secretBox.ts）
 * ------------------------------------------------------------
 * 只用于 system_configs 中 sensitive=true 的字段（如 SMTP 授权码）。
 * 采用 AES-256-GCM，密钥由 CONFIG_SECRET_KEY 经 scrypt 派生；
 * 本地开发未配置密钥时原样返回，生产环境缺失密钥直接失败，避免静默明文落库。
 * ============================================================
 */

import crypto from "crypto";
import env from "@src/config/env.schema";

const PREFIX = "enc:v1:";
const SALT = "v3tm-config-secret";

/** 派生密钥；未配置 CONFIG_SECRET_KEY 时返回 null */
function getKey(): Buffer | null {
  const secret = env.CONFIG_SECRET_KEY?.trim();
  if (!secret) return null;
  return crypto.scryptSync(secret, SALT, 32);
}

/** 加密：已有密文前缀则原样返回，避免重复加密 */
export function sealSecret(value: string): string {
  const key = getKey();
  if (!key) {
    // 生产环境已由 env.schema 强制要求密钥；这里再兜底，防止绕过 schema 的调用方
    if (env.NODE_ENV === "production") {
      throw new Error("CONFIG_SECRET_KEY_MISSING");
    }
    return value;
  }
  if (!value || value.startsWith(PREFIX)) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

/** 解密：无前缀视为历史明文，原样返回 */
export function openSecret(value: string): string {
  if (!value.startsWith(PREFIX)) return value;
  const key = getKey();
  if (!key) throw new Error("CONFIG_SECRET_KEY_MISSING");
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("CONFIG_VALUE_INVALID");
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}
