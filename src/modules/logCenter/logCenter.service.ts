/**
 * ============================================================
 * 日志中心业务逻辑（modules/logCenter/logCenter.service.ts）
 * ------------------------------------------------------------
 * operation / login 同表不同 category，mail 走 mail_logs。
 * 统一查询在应用层合并排序，数据量以保留天数控制。
 * ============================================================
 */

import { prisma } from "@src/db/prisma";
import { getConfigNumber } from "@src/config/runtimeConfig";
import { SUPER_ADMIN_USERNAME } from "@src/constants/role";
import { DEFAULT_LOG_RETENTION_DAYS, LOG_ACTION, LOG_CATEGORY, LOG_RESULT, isLogCategory, isLogResult } from "@src/constants/log";
import type { LogCleanupResult, LogDto, LogListResult, LogSummaryResult } from "./logCenter.model";

interface LogListParams {
  page?: number;
  pageSize?: number;
  category?: string;
  module?: string;
  action?: string;
  result?: string;
  username?: string;
  keyword?: string;
  from?: string;
  to?: string;
}

/** 个人日志参数：不接受 username，范围只由登录主体决定 */
type MyLogListParams = Omit<LogListParams, "username">;

/** 当前登录用户范围：userId 用于 operation/login，email 用于通知邮件收件人 */
interface CurrentUserScope {
  userId: number;
  username: string;
  email: string;
}

class LogCenterService {
  /** 统一列表（全局日志中心） */
  async getList(params: LogListParams, operatorIsSuper: boolean): Promise<LogListResult> {
    return this.queryList(params, { operatorIsSuper });
  }

  /** 个人日志列表：先确认当前用户，再按个人范围查询 */
  async getMyList(params: MyLogListParams, currentUserId: number): Promise<LogListResult> {
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { id: true, username: true, email: true },
    });
    if (!currentUser) {
      throw new Error("USER_NOT_EXIST");
    }

    return this.queryList(params, {
      operatorIsSuper: false,
      currentUser: { userId: currentUser.id, username: currentUser.username, email: currentUser.email },
    });
  }

  /** 列表公共实现：分页、时间范围、三类日志合并排序 */
  private async queryList(
    params: LogListParams,
    options: { operatorIsSuper: boolean; currentUser?: CurrentUserScope }
  ): Promise<LogListResult> {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(Math.max(1, Number(params.pageSize) || 20), 100);
    const offset = (page - 1) * pageSize;
    const take = offset + pageSize;
    const { start, end } = this.resolveRange(params.from, params.to);

    const category = isLogCategory(params.category) ? params.category : undefined;
    const opCategories = category === LOG_CATEGORY.MAIL ? [] : category ? [category] : [LOG_CATEGORY.OPERATION, LOG_CATEGORY.LOGIN];
    const includeMail = !category || category === LOG_CATEGORY.MAIL;

    const tasks: Promise<{ rows: LogDto[]; total: number }>[] = [];
    if (opCategories.length > 0) {
      tasks.push(this.fetchOperationLogs(params, opCategories, start, end, options.operatorIsSuper, take, options.currentUser));
    }
    if (includeMail) {
      tasks.push(this.fetchMailLogs(params, start, end, options.operatorIsSuper, take, options.currentUser));
    }

    const parts = await Promise.all(tasks);
    const total = parts.reduce((sum, part) => sum + part.total, 0);
    const list = parts
      .flatMap((part) => part.rows)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + pageSize);

    return { list, total, page, pageSize };
  }

  /** 概览：按时间范围统计三类日志与结果分布 */
  async getSummary(range: "24h" | "7d" | "30d", operatorIsSuper: boolean): Promise<LogSummaryResult> {
    const days = range === "24h" ? 1 : range === "7d" ? 7 : 30;
    const startAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const opWhere: any = { createdAt: { gte: startAt } };
    if (!operatorIsSuper) opWhere.username = { not: SUPER_ADMIN_USERNAME };
    const mailWhere: any = { createdAt: { gte: startAt } };
    if (!operatorIsSuper) {
      const superIds = await this.getSuperUserIds();
      if (superIds.length > 0) mailWhere.userId = { notIn: superIds };
    }

    const [operation, login, mail, success, failed, blocked, mailSuccess, mailFailed, mailBlocked] = await Promise.all([
      prisma.operationLog.count({ where: { ...opWhere, category: LOG_CATEGORY.OPERATION } }),
      prisma.operationLog.count({ where: { ...opWhere, category: LOG_CATEGORY.LOGIN } }),
      prisma.mailLog.count({ where: mailWhere }),
      prisma.operationLog.count({ where: { ...opWhere, result: LOG_RESULT.SUCCESS } }),
      prisma.operationLog.count({ where: { ...opWhere, result: LOG_RESULT.FAILED } }),
      prisma.operationLog.count({ where: { ...opWhere, result: LOG_RESULT.BLOCKED } }),
      prisma.mailLog.count({ where: { ...mailWhere, status: "sent" } }),
      prisma.mailLog.count({ where: { ...mailWhere, status: "failed" } }),
      prisma.mailLog.count({ where: { ...mailWhere, status: "skipped" } }),
    ]);

    return {
      range,
      startAt,
      operation,
      login,
      mail,
      total: operation + login + mail,
      success: success + mailSuccess,
      failed: failed + mailFailed,
      blocked: blocked + mailBlocked,
    };
  }

  /** 手动清理（P0）：按保留天数删除 operation_logs 与 mail_logs */
  async cleanup(params: { beforeDays?: number; confirm: string }): Promise<LogCleanupResult> {
    if (params.confirm !== "CLEANUP") {
      throw new Error("LOG_CLEANUP_CONFIRM_REQUIRED");
    }

    const configured = Number(getConfigNumber("log_retention_days")) || DEFAULT_LOG_RETENTION_DAYS;
    const beforeDays = Number(params.beforeDays) || configured;
    const beforeAt = new Date(Date.now() - beforeDays * 24 * 60 * 60 * 1000);

    const [opResult, mailResult] = await prisma.$transaction([
      prisma.operationLog.deleteMany({ where: { createdAt: { lt: beforeAt } } }),
      prisma.mailLog.deleteMany({ where: { createdAt: { lt: beforeAt } } }),
    ]);

    return {
      beforeDays,
      beforeAt,
      operationDeleted: opResult.count,
      mailDeleted: mailResult.count,
    };
  }

  /** operation_logs 查询（operation + login） */
  private async fetchOperationLogs(
    params: LogListParams,
    categories: string[],
    start: Date | null,
    end: Date | null,
    operatorIsSuper: boolean,
    take: number,
    currentUser?: CurrentUserScope
  ): Promise<{ rows: LogDto[]; total: number }> {
    const where: any = { category: { in: categories } };
    if (params.module) where.module = params.module;
    if (params.action) where.action = params.action;
    if (isLogResult(params.result)) where.result = params.result;
    // 个人日志不接受 username 参数；全局日志继续保留模糊筛选
    if (params.username && !currentUser) where.username = { contains: params.username };
    if (start || end) {
      where.createdAt = {};
      if (start) where.createdAt.gte = start;
      if (end) where.createdAt.lte = end;
    }

    const and: any[] = [];
    if (currentUser) {
      and.push({
        OR: [
          { userId: currentUser.userId },
          // 失败登录流水 userId 为空，只能按用户名精确匹配归到当前用户
          { category: LOG_CATEGORY.LOGIN, userId: null, username: currentUser.username },
        ],
      });
    } else if (!operatorIsSuper) {
      and.push({ username: { not: SUPER_ADMIN_USERNAME } });
    }

    // 关键字继续用 where.OR；个人范围放在 where.AND，避免两者互相覆盖
    if (params.keyword) {
      where.OR = [
        { module: { contains: params.keyword } },
        { action: { contains: params.keyword } },
        { username: { contains: params.keyword } },
        { target: { contains: params.keyword } },
        { description: { contains: params.keyword } },
        { reason: { contains: params.keyword } },
      ];
    }
    if (and.length > 0) where.AND = and;

    const [total, rows] = await Promise.all([
      prisma.operationLog.count({ where }),
      prisma.operationLog.findMany({ where, orderBy: { createdAt: "desc" }, take }),
    ]);

    return { total, rows: rows.map((row) => this.toOperationDto(row)) };
  }

  /** mail_logs 查询 */
  private async fetchMailLogs(
    params: LogListParams,
    start: Date | null,
    end: Date | null,
    operatorIsSuper: boolean,
    take: number,
    currentUser?: CurrentUserScope
  ): Promise<{ rows: LogDto[]; total: number }> {
    if (params.module && params.module !== "mail") {
      return { rows: [], total: 0 };
    }
    if (params.action && params.action !== "SEND" && params.action !== LOG_ACTION.TEST) {
      return { rows: [], total: 0 };
    }
    // 邮件日志没有操作人用户名；全局查询按 username 筛选时返回空集，个人查询忽略该参数
    if (params.username && !currentUser) {
      return { rows: [], total: 0 };
    }

    const where: any = {};
    if (start || end) {
      where.createdAt = {};
      if (start) where.createdAt.gte = start;
      if (end) where.createdAt.lte = end;
    }
    if (isLogResult(params.result)) {
      if (params.result === LOG_RESULT.SUCCESS) where.status = "sent";
      else if (params.result === LOG_RESULT.FAILED) where.status = "failed";
      else where.status = { in: ["skipped", "pending"] };
    }
    if (params.keyword) {
      where.OR = [
        { subject: { contains: params.keyword } },
        { toEmail: { contains: params.keyword } },
        { template: { contains: params.keyword } },
      ];
    }

    if (currentUser) {
      const mailbox: any[] = [{ userId: currentUser.userId }];
      const email = String(currentUser.email || "").trim();
      if (email) mailbox.push({ toEmail: email });
      // 只保留通知邮件：排除 mail_test / verification_code；
      // mail_test 的 userId 是操作人而非收件人，不能直接作为个人收件范围。
      where.AND = [{ template: { startsWith: "notify_" } }, { OR: mailbox }];
    } else if (!operatorIsSuper) {
      const superIds = await this.getSuperUserIds();
      if (superIds.length > 0) where.userId = { notIn: superIds };
    }

    const [total, rows] = await Promise.all([
      prisma.mailLog.count({ where }),
      prisma.mailLog.findMany({ where, orderBy: { createdAt: "desc" }, take }),
    ]);

    return { total, rows: rows.map((row) => this.toMailDto(row)) };
  }

  private resolveRange(from?: string, to?: string): { start: Date | null; end: Date | null } {
    const start = from ? new Date(from) : null;
    let end: Date | null = null;
    if (to) {
      end = new Date(to);
      if (String(to).length === 10) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000 - 1);
      }
    }
    return {
      start: start && !Number.isNaN(start.getTime()) ? start : null,
      end: end && !Number.isNaN(end.getTime()) ? end : null,
    };
  }

  private async getSuperUserIds(): Promise<number[]> {
    const rows = await prisma.user.findMany({ where: { isSuper: 1 }, select: { id: true } });
    return rows.map((row) => row.id);
  }

  private toOperationDto(row: any): LogDto {
    return {
      id: row.id,
      category: isLogCategory(row.category) ? row.category : LOG_CATEGORY.OPERATION,
      userId: row.userId ?? null,
      username: row.username || "",
      module: row.module || "",
      action: row.action || "",
      result: isLogResult(row.result) ? row.result : LOG_RESULT.SUCCESS,
      reason: row.reason || "",
      target: row.target || "",
      description: row.description || "",
      ip: row.ip || "",
      userAgent: row.userAgent || "",
      requestId: row.requestId ?? null,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    };
  }

  private toMailDto(row: any): LogDto {
    const result = row.status === "sent" ? LOG_RESULT.SUCCESS : row.status === "failed" ? LOG_RESULT.FAILED : LOG_RESULT.BLOCKED;
    return {
      id: row.id,
      category: LOG_CATEGORY.MAIL,
      userId: row.userId ?? null,
      username: "",
      module: "mail",
      action: "SEND",
      result,
      reason: row.error || "",
      target: row.toEmail || "",
      description: row.subject || "",
      ip: "",
      userAgent: "",
      requestId: null,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
      toEmail: row.toEmail || "",
      subject: row.subject || "",
      template: row.template || "",
      messageId: row.messageId ?? null,
    };
  }
}

export default new LogCenterService();
