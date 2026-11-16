/**
 * ============================================================
 * Token 哈希工具（utils/tokenHash.ts）
 * ------------------------------------------------------------
 * Refresh Token 入库前做哈希，防止数据库泄露后 token 被复用
 * ============================================================
 */

import crypto from "crypto";

/**
 * 计算 token 的 SHA-256 哈希
 * @param token 明文 token
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export default hashToken;
