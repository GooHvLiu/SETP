/**
 * ============================================================
 * JWT 配置（config/jwt.config.ts）
 * ------------------------------------------------------------
 * 双令牌机制：
 *   - Access Token：短期（默认 15m），请求鉴权用
 *   - Refresh Token：长期（默认 7d），刷新 access 用，存库可吊销
 * 密钥与过期时间从 env.schema 读取（zod 已校验 JWT_SECRET 长度）
 * ============================================================
 */

import env from "./env.schema";

export interface JwtConfig {
  /** 签名密钥（生产环境必须 >= 32 位随机串） */
  secret: string;
  /** Access Token 有效期 */
  expiresIn: string;
  /** Refresh Token 有效期 */
  refreshExpiresIn: string;
}

const jwtConfig: JwtConfig = {
  secret: env.JWT_SECRET,
  expiresIn: env.JWT_EXPIRES_IN,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
};

export default jwtConfig;
