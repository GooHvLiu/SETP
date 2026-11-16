/**
 * ============================================================
 * 邮件日志（Prisma 版）
 * ------------------------------------------------------------
 * mail_logs 只记录发信元数据与结果，不记录正文、验证码和授权码。
 * test_id 记录一次发送的关联号：测试邮件用 testId，业务发信用 traceId。
 * 业务发信与测试邮件共用同一张表，后台可按 template 区分查看。
 * ============================================================
 */

import { prisma } from "@src/db/prisma";
import type { MailTestLog } from "./mail.model";

interface MailLogRow {
  id: number | bigint;
  user_id: number | null;
  to_email: string;
  subject: string;
  template: string;
  status: string;
  test_id: string | null;
  message_id: string | null;
  error: string | null;
  created_at: Date | string;
  sent_at: Date | string | null;
  received_at: Date | string | null;
}

function mapRow(row: MailLogRow): MailTestLog {
  return {
    id: Number(row.id),
    userId: row.user_id === null ? null : Number(row.user_id),
    toEmail: row.to_email,
    subject: row.subject,
    template: row.template,
    status: row.status,
    testId: row.test_id,
    messageId: row.message_id,
    error: row.error,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    receivedAt: row.received_at,
  };
}

class MailLogService {
  /** 建立一条 pending 测试日志 */
  async createTestLog(params: { userId?: number | null; toEmail: string; subject: string; testId: string }): Promise<void> {
    await prisma.$executeRaw`
      INSERT INTO mail_logs (user_id, to_email, subject, template, status, test_id, created_at)
      VALUES (${params.userId ?? null}, ${params.toEmail}, ${params.subject}, 'mail_test', 'pending', ${params.testId}, CURRENT_TIMESTAMP)
    `;
  }

  /** 建立一条 pending 业务发信日志 */
  async createLog(params: {
    userId?: number | null;
    toEmail: string;
    subject: string;
    template: string;
    traceId: string;
    messageId: string;
  }): Promise<void> {
    await prisma.$executeRaw`
      INSERT INTO mail_logs (user_id, to_email, subject, template, status, test_id, message_id, created_at)
      VALUES (${params.userId ?? null}, ${params.toEmail}, ${params.subject}, ${params.template}, 'pending', ${params.traceId}, ${params.messageId}, CURRENT_TIMESTAMP)
    `;
  }

  /** SMTP 已接受（测试邮件） */
  async markSent(testId: string, messageId: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE mail_logs
      SET status = 'sent', message_id = ${messageId}, sent_at = CURRENT_TIMESTAMP
      WHERE test_id = ${testId}
    `;
  }

  /** SMTP 已接受（业务发信） */
  async markLogSent(traceId: string, messageId: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE mail_logs
      SET status = 'sent', message_id = ${messageId}, sent_at = CURRENT_TIMESTAMP
      WHERE test_id = ${traceId}
    `;
  }

  /** SMTP 已接受但 IMAP 未确认，保留 sent 状态并记录原因 */
  async markNotReceived(testId: string, error: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE mail_logs
      SET status = 'sent', error = ${error}, sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP)
      WHERE test_id = ${testId}
    `;
  }

  /** IMAP 已回读确认；落点为垃圾箱时状态记为 blocked，便于前端区分正常收件与进垃圾箱 */
  async markReceived(testId: string, folder?: string | null): Promise<void> {
    const status = folder === "JUNK" ? "blocked" : "received";
    const error = folder === "JUNK" ? "MAIL_DELIVERED_TO_JUNK" : null;
    await prisma.$executeRaw`
      UPDATE mail_logs
      SET status = ${status}, error = ${error}, received_at = CURRENT_TIMESTAMP
      WHERE test_id = ${testId}
    `;
  }

  /** 发送失败（测试邮件） */
  async markFailed(testId: string, error: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE mail_logs
      SET status = 'failed', error = ${error}
      WHERE test_id = ${testId}
    `;
  }

  /** 发送失败（业务发信） */
  async markLogFailed(traceId: string, error: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE mail_logs
      SET status = 'failed', error = ${error}
      WHERE test_id = ${traceId}
    `;
  }

  /** 最近一次测试记录（状态接口用） */
  async getLatestTest(): Promise<MailTestLog | null> {
    const rows = await prisma.$queryRaw<MailLogRow[]>`
      SELECT id, user_id, to_email, subject, template, status, test_id, message_id, error, created_at, sent_at, received_at
      FROM mail_logs
      WHERE template = 'mail_test'
      ORDER BY id DESC
      LIMIT 1
    `;
    return rows.length ? mapRow(rows[0]) : null;
  }

  /** 最近一次业务发信记录（状态接口用） */
  async getLatestBusiness(): Promise<MailTestLog | null> {
    const rows = await prisma.$queryRaw<MailLogRow[]>`
      SELECT id, user_id, to_email, subject, template, status, test_id, message_id, error, created_at, sent_at, received_at
      FROM mail_logs
      WHERE template <> 'mail_test'
      ORDER BY id DESC
      LIMIT 1
    `;
    return rows.length ? mapRow(rows[0]) : null;
  }

  /** 日志列表（后台查看测试与业务发信） */
  async listLogs(limit: number, template?: string): Promise<MailTestLog[]> {
    const rows = template
      ? await prisma.$queryRaw<MailLogRow[]>`
          SELECT id, user_id, to_email, subject, template, status, test_id, message_id, error, created_at, sent_at, received_at
          FROM mail_logs
          WHERE template = ${template}
          ORDER BY id DESC
          LIMIT ${limit}
        `
      : await prisma.$queryRaw<MailLogRow[]>`
          SELECT id, user_id, to_email, subject, template, status, test_id, message_id, error, created_at, sent_at, received_at
          FROM mail_logs
          ORDER BY id DESC
          LIMIT ${limit}
        `;
    return rows.map(mapRow);
  }
}

export default new MailLogService();
