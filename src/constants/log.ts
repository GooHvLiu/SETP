/**
 * ============================================================
 * 日志中心统一口径（constants/log.ts）
 * ------------------------------------------------------------
 * 三类日志：
 *   operation → operation_logs（category=operation）
 *   login     → operation_logs（category=login）
 *   mail      → mail_logs
 * 运行日志（Pino）不入库、不出现在页面上，只通过 requestId 关联。
 * ============================================================
 */

export const LOG_CATEGORY = {
  OPERATION: "operation",
  LOGIN: "login",
  MAIL: "mail",
} as const;

export type LogCategory = (typeof LOG_CATEGORY)[keyof typeof LOG_CATEGORY];

export const LOG_RESULT = {
  SUCCESS: "success",
  FAILED: "failed",
  BLOCKED: "blocked",
} as const;

export type LogResult = (typeof LOG_RESULT)[keyof typeof LOG_RESULT];

export const LOG_ACTION = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  REVOKE: "REVOKE",
  CLEANUP: "CLEANUP",
  REINDEX: "REINDEX",
  TEST: "TEST",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  RESET_PASSWORD: "RESET_PASSWORD",
} as const;

export type LogAction = (typeof LOG_ACTION)[keyof typeof LOG_ACTION];

export function isLogCategory(value: unknown): value is LogCategory {
  return Object.values(LOG_CATEGORY).includes(value as LogCategory);
}

export function isLogResult(value: unknown): value is LogResult {
  return Object.values(LOG_RESULT).includes(value as LogResult);
}

/** 日志保留天数默认值；上线后可在超级设置中调整 */
export const DEFAULT_LOG_RETENTION_DAYS = 90;
