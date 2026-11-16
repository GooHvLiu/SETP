/**
 * ============================================================
 * 通知中心业务逻辑（modules/notification/notification.service.ts）
 * ------------------------------------------------------------
 * 统一出口 notify()：
 *   1. 解析收件人（userIds ∪ roles，仅取启用且未软删账号）
 *   2. 站内通知按收件人 fan-out 落库，batchId 串联同一次发送
 *   3. 邮件异步发送，失败只回写 emailStatus / mail_logs，不回滚业务
 *
 * 管理员手动发送复用同一套落库逻辑，但禁止定向 superAdmin。
 * ============================================================
 */

import { randomUUID } from "crypto";
import { prisma } from "@src/db/prisma";
import logger from "@src/utils/logger";
import {
  NOTIFICATION_CATEGORY,
  NOTIFICATION_EMAIL_STATUS,
  NOTIFICATION_TYPE,
  isNotificationCategory,
  isNotificationType,
} from "@src/constants/notification";
import type {
  AdminSendNotificationBody,
  NotificationBatchDetailResult,
  NotificationBatchItem,
  NotificationBatchListResult,
  NotificationDto,
  NotificationListResult,
  NotificationSendResult,
  NotifyInput,
} from "./notification.model";
import mailService from "../mail/mail.service";

interface Recipient {
  id: number;
  username: string;
  email: string;
  isSuper: number;
}

interface BatchFilter {
  category?: string;
  type?: string;
  source?: string;
  keyword?: string;
}

class NotificationService {
  /** 统一发送入口（内部事件 / 管理员手动发送） */
  async notify(input: NotifyInput, options: { allowSuper?: boolean } = {}): Promise<NotificationSendResult> {
    const category = isNotificationCategory(input.category) ? input.category : NOTIFICATION_CATEGORY.SYSTEM;
    const type = isNotificationType(input.type) ? input.type : NOTIFICATION_TYPE.INFO;
    const recipients = await this.resolveRecipients({ userIds: input.userIds, roles: input.roles }, options.allowSuper !== false);

    if (recipients.length === 0) {
      throw new Error("NOTIFICATION_RECIPIENT_EMPTY");
    }

    const batchId = randomUUID();
    const needEmail = input.sendEmail === true;
    const data: any[] = recipients.map((r) => ({
      userId: r.id,
      category,
      type,
      title: input.title ?? "",
      content: input.content ?? "",
      titleKey: input.titleKey ?? null,
      contentKey: input.contentKey ?? null,
      data: JSON.stringify(input.data || {}),
      source: input.source || "system",
      link: input.link || "",
      senderId: input.senderId ?? null,
      batchId,
      templateKey: input.templateKey ?? null,
      emailStatus: needEmail
        ? r.email
          ? NOTIFICATION_EMAIL_STATUS.PENDING
          : NOTIFICATION_EMAIL_STATUS.SKIPPED
        : NOTIFICATION_EMAIL_STATUS.NONE,
      emailError: needEmail && !r.email ? "MAIL_RECIPIENT_EMPTY" : null,
    }));

    await prisma.notification.createMany({ data });

    const queued = data.filter((d) => d.emailStatus === NOTIFICATION_EMAIL_STATUS.PENDING).length;
    if (queued > 0) {
      void this.sendBatchEmails(batchId).catch((error) => {
        logger.warn({ batchId, error: (error as Error)?.message }, "Notification email batch failed");
      });
    }

    return {
      batchId,
      recipientCount: recipients.length,
      emailQueued: queued,
      emailSkipped: recipients.length - queued,
    };
  }

  /** 管理员手动发送：不允许定向 superAdmin，收件人为空直接失败 */
  async sendByAdmin(body: AdminSendNotificationBody, senderId: number): Promise<NotificationSendResult> {
    const audience = body.audience;
    if (!audience || !["all", "role", "user"].includes(audience.type)) {
      throw new Error("NOTIFICATION_AUDIENCE_INVALID");
    }

    let userIds: number[] | undefined;
    let roles: string[] | undefined;
    if (audience.type === "user") {
      userIds = Array.isArray(audience.userIds) ? audience.userIds.map(Number).filter((id) => id > 0) : [];
      if (userIds.length === 0) throw new Error("NOTIFICATION_AUDIENCE_INVALID");
    } else if (audience.type === "role") {
      roles = Array.isArray(audience.roleCodes) ? audience.roleCodes.map(String).filter(Boolean) : [];
      if (roles.length === 0) throw new Error("NOTIFICATION_AUDIENCE_INVALID");
    }

    return this.notify(
      {
        userIds,
        roles,
        category: body.category,
        type: body.type,
        title: body.title,
        content: body.content,
        source: "admin",
        link: body.link,
        sendEmail: body.sendEmail === true,
        senderId,
      },
      { allowSuper: false }
    );
  }

  /** 当前用户通知列表 */
  async getList(
    userId: number,
    params: { page?: number; pageSize?: number; isRead?: number; category?: string; type?: string }
  ): Promise<NotificationListResult> {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(Math.max(1, Number(params.pageSize) || 10), 100);
    const offset = (page - 1) * pageSize;

    const where: any = { userId };
    if (params.isRead !== undefined) where.isRead = params.isRead;
    if (isNotificationCategory(params.category)) where.category = params.category;
    if (isNotificationType(params.type)) where.type = params.type;

    const [total, rows] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({ where, orderBy: { id: "desc" }, skip: offset, take: pageSize }),
    ]);

    return { list: rows.map((row) => this.toDto(row)), total, page, pageSize };
  }

  /** 未读数量 */
  async getUnreadCount(userId: number) {
    const count = await prisma.notification.count({ where: { userId, isRead: 0 } });
    return { count };
  }

  /** 标记已读（单条 / 全部），同时补写 readAt */
  async markRead(userId: number, id?: number) {
    const now = new Date();
    if (id) {
      return prisma.notification.updateMany({
        where: { id, userId, isRead: 0 },
        data: { isRead: 1, readAt: now },
      });
    }
    return prisma.notification.updateMany({
      where: { userId, isRead: 0 },
      data: { isRead: 1, readAt: now },
    });
  }

  /** 批次列表（管理员） */
  async getBatches(params: BatchFilter & { page?: number; pageSize?: number } = {}): Promise<NotificationBatchListResult> {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(Math.max(1, Number(params.pageSize) || 10), 100);
    const offset = (page - 1) * pageSize;
    const { whereSql, whereParams } = this.buildBatchWhere(params);

    const [rows, totalRows] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT batch_id, MIN(id) AS first_id, MIN(title) AS title, MIN(title_key) AS title_key,
                MIN(category) AS category,
                MIN(type) AS type, MIN(source) AS source, MAX(created_at) AS created_at,
                COUNT(*) AS recipient_count,
                SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) AS read_count,
                SUM(CASE WHEN email_status = 'pending' THEN 1 ELSE 0 END) AS email_pending,
                SUM(CASE WHEN email_status = 'sent' THEN 1 ELSE 0 END) AS email_sent,
                SUM(CASE WHEN email_status = 'failed' THEN 1 ELSE 0 END) AS email_failed,
                SUM(CASE WHEN email_status = 'skipped' THEN 1 ELSE 0 END) AS email_skipped
         FROM notifications
         WHERE batch_id IS NOT NULL ${whereSql}
         GROUP BY batch_id
         ORDER BY MAX(id) DESC
         LIMIT ? OFFSET ?`,
        ...whereParams,
        pageSize,
        offset
      ),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(DISTINCT batch_id) AS total FROM notifications WHERE batch_id IS NOT NULL ${whereSql}`,
        ...whereParams
      ),
    ]);

    return {
      list: rows.map((row) => this.toBatchItem(row)),
      total: Number(totalRows[0]?.total || 0),
      page,
      pageSize,
    };
  }

  /** 批次详情（管理员） */
  async getBatchDetail(batchId: string, params: { page?: number; pageSize?: number } = {}): Promise<NotificationBatchDetailResult> {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(Math.max(1, Number(params.pageSize) || 20), 100);
    const offset = (page - 1) * pageSize;

    const [batchRows, total, rows] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT batch_id, MIN(id) AS first_id, MIN(title) AS title, MIN(title_key) AS title_key,
                MIN(category) AS category,
                MIN(type) AS type, MIN(source) AS source, MAX(created_at) AS created_at,
                COUNT(*) AS recipient_count,
                SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) AS read_count,
                SUM(CASE WHEN email_status = 'pending' THEN 1 ELSE 0 END) AS email_pending,
                SUM(CASE WHEN email_status = 'sent' THEN 1 ELSE 0 END) AS email_sent,
                SUM(CASE WHEN email_status = 'failed' THEN 1 ELSE 0 END) AS email_failed,
                SUM(CASE WHEN email_status = 'skipped' THEN 1 ELSE 0 END) AS email_skipped
         FROM notifications WHERE batch_id = ? GROUP BY batch_id LIMIT 1`,
        batchId
      ),
      prisma.notification.count({ where: { batchId } }),
      prisma.notification.findMany({ where: { batchId }, orderBy: { id: "desc" }, skip: offset, take: pageSize }),
    ]);

    if (batchRows.length === 0) {
      throw new Error("NOTIFICATION_NOT_FOUND");
    }

    return {
      batch: this.toBatchItem(batchRows[0]),
      list: rows.map((row) => this.toDto(row)),
      total,
      page,
      pageSize,
    };
  }

  /** 重试失败邮件（P1，批次内 failed 的记录） */
  async retryFailedEmails(batchId: string): Promise<{ retried: number; sent: number; failed: number }> {
    const rows = await prisma.notification.findMany({
      where: { batchId, emailStatus: NOTIFICATION_EMAIL_STATUS.FAILED },
      orderBy: { id: "asc" },
    });
    if (rows.length === 0) {
      throw new Error("NOTIFICATION_NOT_FOUND");
    }

    let sent = 0;
    let failed = 0;
    for (const row of rows) {
      const user = await prisma.user.findFirst({
        where: { id: row.userId, status: 1, isDeleted: 0 },
        select: { email: true },
      });
      if (!user?.email) {
        await prisma.notification.update({
          where: { id: row.id },
          data: { emailStatus: NOTIFICATION_EMAIL_STATUS.SKIPPED, emailError: "MAIL_RECIPIENT_EMPTY" },
        });
        continue;
      }

      const result = await mailService.sendNotificationMail({
        to: user.email,
        userId: row.userId,
        title: row.title,
        content: row.content,
        category: isNotificationCategory(row.category) ? row.category : NOTIFICATION_CATEGORY.SYSTEM,
        link: row.link,
      });
      if (result.status === "sent") {
        sent += 1;
        await prisma.notification.update({
          where: { id: row.id },
          data: { emailStatus: NOTIFICATION_EMAIL_STATUS.SENT, emailError: null },
        });
      } else if (result.status === "skipped") {
        await prisma.notification.update({
          where: { id: row.id },
          data: { emailStatus: NOTIFICATION_EMAIL_STATUS.SKIPPED, emailError: result.error || null },
        });
      } else {
        failed += 1;
        await prisma.notification.update({
          where: { id: row.id },
          data: { emailStatus: NOTIFICATION_EMAIL_STATUS.FAILED, emailError: result.error || "MAIL_SEND_FAILED" },
        });
      }
    }

    return { retried: rows.length, sent, failed };
  }

  /** 解析收件人：userIds 与 roles 取并集，仅启用且未软删 */
  private async resolveRecipients(input: { userIds?: number[]; roles?: string[] }, allowSuper: boolean): Promise<Recipient[]> {
    const ids = Array.isArray(input.userIds) ? input.userIds.map(Number).filter((id) => id > 0) : [];
    const roles = Array.isArray(input.roles) ? input.roles.map(String).filter(Boolean) : [];

    const base: any = { status: 1, isDeleted: 0 };
    if (!allowSuper) base.isSuper = 0;

    if (ids.length === 0 && roles.length === 0) {
      return prisma.user.findMany({
        where: base,
        select: { id: true, username: true, email: true, isSuper: true },
      });
    }

    const or: any[] = [];
    if (ids.length > 0) or.push({ id: { in: ids } });
    if (roles.length > 0) {
      or.push({ roles: { some: { role: { code: { in: roles }, status: 1 } } } });
    }

    const rows = await prisma.user.findMany({
      where: { ...base, OR: or },
      select: { id: true, username: true, email: true, isSuper: true },
    });

    const map = new Map<number, Recipient>();
    for (const row of rows) {
      if (!allowSuper && row.isSuper === 1) continue;
      map.set(row.id, { id: row.id, username: row.username, email: row.email || "", isSuper: row.isSuper });
    }
    return Array.from(map.values());
  }

  /** 异步发送整批邮件；逐收件人单独发，避免群发泄露邮箱 */
  private async sendBatchEmails(batchId: string) {
    const rows = await prisma.notification.findMany({
      where: { batchId, emailStatus: NOTIFICATION_EMAIL_STATUS.PENDING },
      orderBy: { id: "asc" },
    });

    for (const row of rows) {
      const user = await prisma.user.findFirst({
        where: { id: row.userId, status: 1, isDeleted: 0 },
        select: { email: true },
      });
      if (!user?.email) {
        await prisma.notification.update({
          where: { id: row.id },
          data: { emailStatus: NOTIFICATION_EMAIL_STATUS.SKIPPED, emailError: "MAIL_RECIPIENT_EMPTY" },
        });
        continue;
      }

      try {
        const result = await mailService.sendNotificationMail({
          to: user.email,
          userId: row.userId,
          title: row.title,
          content: row.content,
          category: isNotificationCategory(row.category) ? row.category : NOTIFICATION_CATEGORY.SYSTEM,
          link: row.link,
        });
        if (result.status === "sent") {
          await prisma.notification.update({
            where: { id: row.id },
            data: { emailStatus: NOTIFICATION_EMAIL_STATUS.SENT, emailError: null },
          });
        } else if (result.status === "skipped") {
          await prisma.notification.update({
            where: { id: row.id },
            data: { emailStatus: NOTIFICATION_EMAIL_STATUS.SKIPPED, emailError: result.error || null },
          });
        } else {
          await prisma.notification.update({
            where: { id: row.id },
            data: { emailStatus: NOTIFICATION_EMAIL_STATUS.FAILED, emailError: result.error || "MAIL_SEND_FAILED" },
          });
        }
      } catch (error) {
        await prisma.notification.update({
          where: { id: row.id },
          data: {
            emailStatus: NOTIFICATION_EMAIL_STATUS.FAILED,
            emailError: (error as Error)?.message || "MAIL_SEND_FAILED",
          },
        });
      }
    }
  }

  /** 批次筛选条件 */
  private buildBatchWhere(params: BatchFilter) {
    const where: string[] = [];
    const values: any[] = [];
    if (params.category) {
      where.push("AND category = ?");
      values.push(params.category);
    }
    if (params.type) {
      where.push("AND type = ?");
      values.push(params.type);
    }
    if (params.source) {
      where.push("AND source = ?");
      values.push(params.source);
    }
    if (params.keyword) {
      where.push("AND title LIKE ?");
      values.push(`%${params.keyword}%`);
    }
    return { whereSql: where.join(" "), whereParams: values };
  }

  private toDto(row: any): NotificationDto {
    let data: Record<string, any> = {};
    try {
      data = JSON.parse(row.data || "{}");
    } catch {
      data = {};
    }
    return {
      id: row.id,
      userId: row.userId,
      category: isNotificationCategory(row.category) ? row.category : NOTIFICATION_CATEGORY.SYSTEM,
      title: row.title,
      content: row.content,
      titleKey: row.titleKey ?? null,
      contentKey: row.contentKey ?? null,
      type: isNotificationType(row.type) ? row.type : NOTIFICATION_TYPE.INFO,
      data,
      source: row.source || "",
      link: row.link || "",
      senderId: row.senderId ?? null,
      batchId: row.batchId ?? null,
      templateKey: row.templateKey ?? null,
      emailStatus: row.emailStatus || NOTIFICATION_EMAIL_STATUS.NONE,
      emailError: row.emailError ?? null,
      isRead: row.isRead,
      readAt: row.readAt ?? null,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    };
  }

  private toBatchItem(row: any): NotificationBatchItem {
    const createdAt = row.created_at ?? row.createdAt;
    return {
      batchId: String(row.batch_id ?? row.batchId),
      title: row.title || "",
      titleKey: row.title_key ?? row.titleKey ?? null,
      category: isNotificationCategory(row.category) ? row.category : NOTIFICATION_CATEGORY.SYSTEM,
      type: isNotificationType(row.type) ? row.type : NOTIFICATION_TYPE.INFO,
      source: row.source || "",
      recipientCount: Number(row.recipient_count ?? 0),
      readCount: Number(row.read_count ?? 0),
      emailPending: Number(row.email_pending ?? 0),
      emailSent: Number(row.email_sent ?? 0),
      emailFailed: Number(row.email_failed ?? 0),
      emailSkipped: Number(row.email_skipped ?? 0),
      createdAt: createdAt instanceof Date ? createdAt : new Date(createdAt),
    };
  }
}

export default new NotificationService();
