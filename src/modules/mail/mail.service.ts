/**
 * ============================================================
 * 邮件服务（modules/mail/mail.service.ts）
 * ------------------------------------------------------------
 * 统一出口：
 *   - 正常业务发信：sendMail / sendVerificationCode
 *   - 超级设置页测试：test（SMTP 发送 + IMAP 回读确认）
 *   - 状态读取：getStatus / listLogs
 *
 * 发信参数只从 system_configs（超级设置）读取；MAIL_INIT_* 只供 seed 使用一次。
 * SMTP 250 只代表「服务器接受了信」，不代表「用户收到了信」；
 * 所以测试接口默认再用 IMAP 回读一次，只有回读到 testId 才判定 received=true。
 * 回读同时检查 INBOX 与垃圾箱：QQ 邮箱常把「陌生发件人 + 验证码」判进垃圾箱，
 * 只在收件箱找会误报「没收到」。
 * ============================================================
 */

import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { ImapFlow } from "imapflow";
import { getConfigBoolean, getConfigNumber, getConfigValue } from "@src/config/runtimeConfig";
import mailLogService from "./mail.log.service";
import { NOTIFICATION_CATEGORY_LABEL, notificationMailTemplate } from "@src/constants/notification";
import type { NotificationCategory } from "@src/constants/notification";
import {
  renderNotificationEmail,
  renderNotificationText,
  renderTestEmail,
  renderTestEmailText,
  renderVerificationCodeEmail,
  renderVerificationCodeText,
} from "./mail.template";
import type { MailSendOptions, MailSendResult, MailStatusResult, MailTestMode, MailTestResult } from "./mail.model";

interface MailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName: string;
  timeoutMs: number;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  readback: boolean;
  readbackTimeoutMs: number;
}

/** 站点名来自配置中心，避免服务层再写死品牌 */
function mailSiteName(): string {
  return getConfigValue("site_name").trim();
}

function getMailConfig(): MailConfig {
  const user = getConfigValue("mail_smtp_user").trim();
  return {
    enabled: getConfigBoolean("mail_enabled"),
    host: getConfigValue("mail_smtp_host").trim(),
    port: getConfigNumber("mail_smtp_port"),
    secure: getConfigBoolean("mail_smtp_secure"),
    user,
    pass: getConfigValue("mail_smtp_pass").trim(),
    from: getConfigValue("mail_from").trim() || user,
    fromName: getConfigValue("mail_from_name").trim() || getConfigValue("site_name").trim(),
    timeoutMs: getConfigNumber("mail_timeout_ms"),
    imapHost: getConfigValue("mail_imap_host").trim(),
    imapPort: getConfigNumber("mail_imap_port"),
    imapSecure: getConfigBoolean("mail_imap_secure"),
    readback: getConfigBoolean("mail_test_readback"),
    readbackTimeoutMs: getConfigNumber("mail_test_readback_timeout_ms"),
  };
}

function isConfigured(config: MailConfig): boolean {
  return Boolean(config.host && config.port && config.user && config.pass);
}

function assertConfigured(config: MailConfig): void {
  if (!isConfigured(config)) throw new Error("MAIL_NOT_CONFIGURED");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.user)) throw new Error("MAIL_NOT_CONFIGURED");
}

function assertRecipient(to: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("MAIL_RECIPIENT_INVALID");
}

function createTransport(config: MailConfig) {
  // 显式声明 SMTPTransport.Options，避免对象字面量在 createTransport 重载中匹配失败
  const options: SMTPTransport.Options = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    connectionTimeout: config.timeoutMs,
    greetingTimeout: config.timeoutMs,
    socketTimeout: config.timeoutMs,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
  return nodemailer.createTransport(options);
}

/** 把底层邮件错误收敛成业务错误码，前端只看稳定错误码 */
function mapMailError(error: unknown): string {
  const code = String((error as { code?: unknown } | null)?.code || "");
  if (code === "EAUTH") return "MAIL_AUTH_FAILED";
  if (code === "EENVELOPE") return "MAIL_RECIPIENT_INVALID";
  if (["ECONNECTION", "ECONNREFUSED", "ENOTFOUND", "ESOCKET", "ETIMEDOUT"].includes(code)) {
    return "MAIL_CONNECT_FAILED";
  }
  return "MAIL_SEND_FAILED";
}

/** sendMail 抛出的已经是业务码，二次收敛时不要把它再降级成 MAIL_SEND_FAILED */
function toMailErrorCode(error: unknown): string {
  const message = String((error as Error | null)?.message || "");
  if (message.startsWith("MAIL_")) return message;
  return mapMailError(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTime(value: Date = new Date()): string {
  return value.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * IMAP 回读：轮询 INBOX 与垃圾箱，按序列号拉取最近 50 封邮件并在本地匹配 testId。
 * QQ IMAP 对「中文前缀 + 局部 testId」的服务端 SUBJECT 搜索不稳定，
 * 所以这里完全绕开 SEARCH：FETCH 最近的 envelope，按 subject / messageId 本地匹配。
 * 返回 received、落点 folder 与失败原因；不会抛出底层异常。
 */
const READBACK_SCAN_LIMIT = 50;
const READBACK_MAILBOXES = ["INBOX", "&XfJT0ZAB-", "Junk"];

function toText(value: unknown): string {
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return typeof value === "string" ? value : "";
}

function messageMatchesTestId(message: any, testId: string): boolean {
  const subject = toText(message?.envelope?.subject);
  const messageId = toText(message?.envelope?.messageId);
  const headers = toText(message?.headers);
  return subject.includes(testId) || messageId.includes(testId) || headers.includes(testId);
}

async function fetchMatches(client: ImapFlow, range: string, testId: string): Promise<boolean> {
  for await (const message of client.fetch(range, { envelope: true })) {
    if (messageMatchesTestId(message, testId)) return true;
  }
  return false;
}

async function scanMailbox(client: ImapFlow, box: string, testId: string): Promise<{ scanned: boolean; matched: boolean }> {
  const lock = await client.getMailboxLock(box);
  try {
    const exists = Number(client.mailbox ? client.mailbox.exists : 0);
    if (exists <= 0) return { scanned: true, matched: false };
    const start = Math.max(1, exists - READBACK_SCAN_LIMIT + 1);
    const matched = await fetchMatches(client, `${start}:*`, testId);
    return { scanned: true, matched };
  } finally {
    lock.release();
  }
}

async function waitForInbox(
  config: MailConfig,
  testId: string,
  timeoutMs: number
): Promise<{ received: boolean; folder: string | null; error: string | null }> {
  const deadline = Date.now() + Math.max(5000, timeoutMs);
  let connectedOnce = false;
  let scannedOnce = false;
  let lastError = "";

  while (Date.now() < deadline) {
    const client = new ImapFlow({
      host: config.imapHost,
      port: config.imapPort,
      secure: config.imapSecure,
      auth: { user: config.user, pass: config.pass },
      logger: false,
      socketTimeout: Math.min(config.timeoutMs, 10000),
    });

    try {
      await client.connect();
      connectedOnce = true;
      for (const box of READBACK_MAILBOXES) {
        try {
          const result = await scanMailbox(client, box, testId);
          if (result.scanned) scannedOnce = true;
          if (result.matched) {
            const folder = box === "INBOX" ? "INBOX" : "JUNK";
            return {
              received: true,
              folder,
              error: folder === "JUNK" ? "MAIL_DELIVERED_TO_JUNK" : null,
            };
          }
        } catch (error) {
          lastError = String((error as Error)?.message || error);
        }
      }
    } catch (error) {
      lastError = String((error as Error)?.message || error);
    } finally {
      try {
        await client.logout();
      } catch {
        // 连接已断开时 logout 会抛错，忽略即可
      }
    }

    await sleep(2500);
  }

  if (!connectedOnce) {
    return { received: false, folder: null, error: `MAIL_IMAP_FAILED${lastError ? `: ${lastError}` : ""}` };
  }
  if (!scannedOnce && lastError) {
    return { received: false, folder: null, error: `MAIL_IMAP_FAILED: ${lastError}` };
  }
  return { received: false, folder: null, error: "MAIL_NOT_RECEIVED" };
}

class MailService {
  /** 当前邮件服务状态（授权码只返回“是否已设置”，不返回明文） */
  async getStatus(): Promise<MailStatusResult> {
    const config = getMailConfig();
    return {
      enabled: config.enabled,
      configured: isConfigured(config),
      passSet: Boolean(config.pass),
      smtp: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        from: config.from,
        fromName: config.fromName,
        timeoutMs: config.timeoutMs,
      },
      imap: {
        host: config.imapHost,
        port: config.imapPort,
        secure: config.imapSecure,
        readback: config.readback,
        timeoutMs: config.readbackTimeoutMs,
      },
      lastTest: await mailLogService.getLatestTest(),
      lastBusiness: await mailLogService.getLatestBusiness(),
    };
  }

  /** 邮件日志列表：测试邮件与业务发信统一查看 */
  async listLogs(limit = 20, template?: string) {
    return mailLogService.listLogs(limit, template);
  }

  /**
   * 发一封普通业务邮件。
   * 注意：这里只判断 SMTP 是否接受，不做 IMAP 回读；
   * 需要“确认收到”的场景请走 test 或后续业务自己的回读逻辑。
   */
  async sendMail(options: MailSendOptions): Promise<MailSendResult> {
    const config = getMailConfig();
    if (!config.enabled && !options.ignoreEnabled) throw new Error("MAIL_DISABLED");
    assertConfigured(config);
    assertRecipient(options.to);

    const transporter = createTransport(config);
    try {
      const info = await transporter.sendMail({
        from: { name: config.fromName, address: config.from },
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        messageId: options.messageId,
        replyTo: { name: config.fromName, address: config.from },
        headers: {
          "Auto-Submitted": "auto-generated",
          "X-Auto-Response-Suppress": "All",
          "X-Mailer": mailSiteName(),
          ...(options.headers || {}),
        },
      });

      if (!info.accepted || info.accepted.length === 0) {
        throw Object.assign(new Error("recipient rejected"), { code: "EENVELOPE" });
      }

      return {
        messageId: info.messageId || options.messageId || "",
        accepted: info.accepted.map(String),
        rejected: (info.rejected || []).map(String),
        response: info.response || "",
      };
    } catch (error) {
      throw new Error(mapMailError(error));
    } finally {
      transporter.close();
    }
  }

  /**
   * 站内通知同步发信。
   * 与验证码发信一样落 mail_logs：pending → sent / failed。
   * 开关口径：mail_notify_enabled 与 mail_enabled 同时为 true 才真正发信，
   * 任一关闭都返回 skipped，由调用方回写 notifications.emailStatus，不影响站内通知。
   */
  async sendNotificationMail(params: {
    to: string;
    userId?: number | null;
    title: string;
    content: string;
    category: NotificationCategory;
    link?: string;
  }): Promise<{ status: "sent" | "failed" | "skipped"; messageId?: string; error?: string }> {
    if (!getConfigBoolean("mail_notify_enabled") || !getConfigBoolean("mail_enabled")) {
      return { status: "skipped", error: "MAIL_DISABLED" };
    }

    const to = String(params.to || "").trim();
    if (!to) {
      return { status: "skipped", error: "MAIL_RECIPIENT_EMPTY" };
    }

    const config = getMailConfig();
    const siteName = mailSiteName();
    const domain = config.from.split("@")[1] || config.user.split("@")[1] || "example.com";
    const messageId = `<${randomUUID()}@${domain}>`;
    const subject = `[${siteName}] ${params.title}`;
    const template = notificationMailTemplate(params.category);
    const traceId = `notify-${randomUUID()}`;
    let logged = false;

    try {
      await mailLogService.createLog({
        userId: params.userId ?? null,
        toEmail: to,
        subject,
        template,
        traceId,
        messageId,
      });
      logged = true;
    } catch {
      // 日志失败不阻断发信
    }

    try {
      const result = await this.sendMail({
        to,
        subject,
        html: renderNotificationEmail({
          siteName,
          title: params.title,
          content: params.content,
          categoryLabel: NOTIFICATION_CATEGORY_LABEL[params.category],
          link: params.link,
        }),
        text: renderNotificationText({
          siteName,
          title: params.title,
          content: params.content,
          categoryLabel: NOTIFICATION_CATEGORY_LABEL[params.category],
          link: params.link,
        }),
        template,
        messageId,
        userId: params.userId ?? null,
      });
      if (logged) {
        try {
          await mailLogService.markLogSent(traceId, result.messageId);
        } catch {
          // 状态回写失败不影响发信结果
        }
      }
      return { status: "sent", messageId: result.messageId };
    } catch (error) {
      const code = toMailErrorCode(error);
      if (logged) {
        try {
          await mailLogService.markLogFailed(traceId, code);
        } catch {
          // 同上
        }
      }
      return { status: "failed", error: code };
    }
  }

  /**
   * 发送验证码邮件（找回密码 / 二次验证复用）。
   * 业务发信同样落 mail_logs：pending → sent / failed，
   * 后台可按 template=verification_code 查看完整发信记录。
   */
  async sendVerificationCode(params: {
    to: string;
    code: string;
    expiresMinutes?: number;
    purpose?: string;
    userId?: number | null;
  }): Promise<MailSendResult> {
    const config = getMailConfig();
    const siteName = mailSiteName();
    const expiresMinutes = params.expiresMinutes || 10;
    const purpose = params.purpose || "验证身份";
    const domain = config.from.split("@")[1] || config.user.split("@")[1] || "example.com";
    const messageId = `<${randomUUID()}@${domain}>`;
    const subject = `[${siteName}] ${purpose}验证码`;
    const traceId = `verify-${randomUUID()}`;

    let logged = false;
    try {
      await mailLogService.createLog({
        userId: params.userId ?? null,
        toEmail: params.to,
        subject,
        template: "verification_code",
        traceId,
        messageId,
      });
      logged = true;
    } catch {
      // 日志失败不能阻断发信，继续走 SMTP
    }

    try {
      const result = await this.sendMail({
        to: params.to,
        subject,
        html: renderVerificationCodeEmail({
          siteName,
          recipient: params.to,
          code: params.code,
          expiresMinutes,
          purpose,
        }),
        text: renderVerificationCodeText({
          siteName,
          code: params.code,
          expiresMinutes,
          purpose,
        }),
        template: "verification_code",
        messageId,
        userId: params.userId ?? null,
      });
      if (logged) {
        try {
          await mailLogService.markLogSent(traceId, result.messageId);
        } catch {
          // 日志状态更新失败不影响发信结果
        }
      }
      return result;
    } catch (error) {
      const code = toMailErrorCode(error);
      if (logged) {
        try {
          await mailLogService.markLogFailed(traceId, code);
        } catch {
          // 同上
        }
      }
      throw new Error(code);
    }
  }

  /**
   * 超级设置页「测试」按钮。
   * verify：只验证 SMTP 登录；
   * send：向指定收件人发一封带唯一 testId 的测试邮件；
   * full：发送后默认再用 IMAP 回读，收到才算 received=true。
   * to 不传时收件人仍为发件邮箱自己；传外部收件人时无法用发件账号的 IMAP 回读，会明确返回跳过原因。
   */
  async test(mode: MailTestMode = "full", userId?: number | null, to?: string): Promise<MailTestResult> {
    const startedAt = Date.now();
    const config = getMailConfig();
    assertConfigured(config);

    const recipient = (to || config.user).trim();
    assertRecipient(recipient);
    const sameMailbox = recipient.toLowerCase() === config.user.trim().toLowerCase();

    if (mode === "verify") {
      const transporter = createTransport(config);
      try {
        await transporter.verify();
        return {
          mode,
          status: "verified",
          testId: null,
          to: recipient,
          subject: "",
          messageId: null,
          smtpAccepted: true,
          received: null,
          receivedFolder: null,
          readbackEnabled: config.readback && sameMailbox,
          readbackError: null,
          error: null,
          elapsedMs: Date.now() - startedAt,
          sentAt: null,
        };
      } catch (error) {
        throw new Error(mapMailError(error));
      } finally {
        transporter.close();
      }
    }

    const testId = `MAIL-${randomUUID()}`;
    const siteName = mailSiteName();
    const domain = config.from.split("@")[1] || config.user.split("@")[1] || "example.com";
    const messageId = `<${testId}@${domain}>`;
    const subject = `[${siteName}] 邮件服务测试 ${testId}`;
    const sentAt = new Date();

    await mailLogService.createTestLog({
      userId: userId ?? null,
      toEmail: recipient,
      subject,
      testId,
    });

    let smtpMessageId = messageId;
    try {
      const result = await this.sendMail({
        to: recipient,
        subject,
        html: renderTestEmail({
          siteName,
          recipient,
          testId,
          messageId,
          sentAt: formatTime(sentAt),
        }),
        text: renderTestEmailText({
          siteName,
          recipient,
          testId,
          messageId,
          sentAt: formatTime(sentAt),
        }),
        template: "mail_test",
        testId,
        messageId,
        headers: { "X-Mail-Test-Id": testId },
        ignoreEnabled: true,
        userId,
      });
      smtpMessageId = result.messageId || messageId;
      await mailLogService.markSent(testId, smtpMessageId);
    } catch (error) {
      const code = toMailErrorCode(error);
      await mailLogService.markFailed(testId, code);
      throw new Error(code);
    }

    let received: boolean | null = null;
    let receivedFolder: string | null = null;
    let readbackError: string | null = null;
    const readbackEnabled = config.readback && sameMailbox;
    if (config.readback && mode === "full") {
      if (!sameMailbox) {
        readbackError = "MAIL_READBACK_SKIPPED_EXTERNAL_RECIPIENT";
      } else {
        const readback = await waitForInbox(config, testId, config.readbackTimeoutMs);
        received = readback.received;
        receivedFolder = readback.folder;
        readbackError = readback.error;
        if (received) {
          await mailLogService.markReceived(testId, receivedFolder);
        } else {
          await mailLogService.markNotReceived(testId, readback.error || "MAIL_NOT_RECEIVED");
        }
      }
    }

    return {
      mode,
      status: received === true ? (receivedFolder === "JUNK" ? "blocked" : "received") : "sent",
      testId,
      to: recipient,
      subject,
      messageId: smtpMessageId,
      smtpAccepted: true,
      received,
      receivedFolder,
      readbackEnabled,
      readbackError,
      error: readbackError,
      elapsedMs: Date.now() - startedAt,
      sentAt: sentAt.toISOString(),
    };
  }
}

export default new MailService();
