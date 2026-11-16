/**
 * ============================================================
 * 日志中心类型定义（modules/logCenter/logCenter.model.ts）
 * ------------------------------------------------------------
 * 三类日志统一查询：operation / login（operation_logs）、mail（mail_logs）
 * ============================================================
 */

import type { LogCategory, LogResult } from "../../constants/log";

/** 统一日志行 */
export interface LogDto {
  id: number;
  category: LogCategory;
  userId: number | null;
  username: string;
  module: string;
  action: string;
  result: LogResult;
  reason: string;
  target: string;
  description: string;
  ip: string;
  userAgent: string;
  requestId: string | null;
  createdAt: Date;
  /** 邮件日志专属字段，页面按 mail 页签展示 */
  toEmail?: string;
  subject?: string;
  template?: string;
  messageId?: string | null;
}

/** 分页列表 */
export interface LogListResult {
  list: LogDto[];
  total: number;
  page: number;
  pageSize: number;
}

/** 概览 */
export interface LogSummaryResult {
  range: "24h" | "7d" | "30d";
  startAt: Date;
  operation: number;
  login: number;
  mail: number;
  total: number;
  success: number;
  failed: number;
  blocked: number;
}

/** 清理结果 */
export interface LogCleanupResult {
  beforeDays: number;
  beforeAt: Date;
  operationDeleted: number;
  mailDeleted: number;
}
