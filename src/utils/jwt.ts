/**
 * ============================================================
 * JWT 工具（utils/jwt.ts）
 * ------------------------------------------------------------
 * 双令牌机制封装：
 *   - signAccessToken：签发短期 Access Token（请求鉴权）
 *   - signRefreshToken：签发长期 Refresh Token（用于刷新、存库）
 *   - verifyToken：校验并解析 token
 * 安全设计：
 *   - Refresh Token 只存哈希入库（见 auth.service），泄露不可复用
 *   - Access Token 携带会话号（sid）指向 refresh_tokens 记录，
 *     鉴权时校验该会话未吊销/未过期，使「踢下线」立即生效
 * ============================================================
 */

import jwt, { SignOptions } from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import jwtConfig from "../config/jwt.config";

/** JWT 载荷类型 */
export interface JwtPayload {
  userId: number;
  username: string;
  /** 令牌类型：access 访问令牌 / refresh 刷新令牌 */
  type?: "access" | "refresh";
  /** 令牌版本号（users.token_version）：改密/禁用/删除后 +1，旧令牌立即失效 */
  v?: number;
  /** 会话号（refresh_tokens.id）：鉴权时据此判断会话是否已被吊销 */
  sid?: number;
  [key: string]: any;
}

/**
 * 签发 Access Token（短期，默认 15m）
 * @param payload 用户信息
 */
export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, type: "access", jti: randomUUID() }, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn } as SignOptions);
}

/**
 * 签发 Refresh Token（长期，默认 7d）
 * @param payload 用户信息
 */
export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, type: "refresh", jti: randomUUID() }, jwtConfig.secret, {
    expiresIn: jwtConfig.refreshExpiresIn,
  } as SignOptions);
}

/**
 * 校验 token，返回解析后的 payload，失败返回 null
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, jwtConfig.secret) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * 校验 Refresh Token（必须 type=refresh，防止拿 access 当 refresh 用）
 */
export function verifyRefreshToken(token: string): JwtPayload | null {
  const payload = verifyToken(token);
  if (!payload || payload.type !== "refresh") return null;
  return payload;
}
