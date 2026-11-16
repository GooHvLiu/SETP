/**
 * ============================================================
 * 会话中心数据类型（modules/session/session.model.ts）
 * ------------------------------------------------------------
 * 数据源：refresh_tokens（一条刷新令牌 = 一个登录设备会话）
 *   - status 由 revoked 与 expiresAt 实时计算，不落库
 *   - active   未吊销且未过期
 *   - expired  未吊销但已过期
 *   - revoked  已吊销
 * ============================================================
 */

/** 会话状态 */
export type SessionStatus = "active" | "expired" | "revoked";

/** 单条会话（对外结构，不暴露 token_hash） */
export interface SessionItem {
  id: number;
  userId: number;
  username: string;
  status: SessionStatus;
  expiresAt: string;
  createdAt: string;
}

/** 概览统计 */
export interface SessionSummary {
  total: number;
  active: number;
  expired: number;
  revoked: number;
  /** 涉及的用户数（去重） */
  users: number;
}

/** 会话列表结果 */
export interface SessionListResult {
  summary: SessionSummary;
  list: SessionItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 踢下线结果 */
export interface SessionRevokeResult {
  id: number;
  revoked: boolean;
  /** 是否同时提升令牌版本号（该用户全部设备立即失效） */
  force: boolean;
  /** force=true 时返回提升后的版本号 */
  tokenVersion?: number;
}

/** 批量踢下线结果 */
export interface SessionBatchRevokeResult {
  affected: number;
  force: boolean;
}

/** 清理结果 */
export interface SessionCleanupResult {
  /** 本次物理清理的记录数 */
  deleted: number;
  /** 清理阈值（天） */
  beforeDays: number;
}
