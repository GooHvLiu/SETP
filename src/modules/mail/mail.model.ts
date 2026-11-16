/**
 * ============================================================
 * 邮件服务类型定义（modules/mail/mail.model.ts）
 * ------------------------------------------------------------
 * 统一说明接口返回结构，前端可直接按这些类型建模。
 * 注意：configValue 中的授权码永远只会是掩码，不会返回明文。
 * ============================================================
 */

/** 测试模式：full=发送并 IMAP 回读；send=只发送；verify=只验证 SMTP 登录 */
export type MailTestMode = "full" | "send" | "verify";

/** 测试接口请求体 */
export interface MailTestBody {
  mode?: MailTestMode;
  /** 测试收件人；不传时使用发件邮箱自己。传外部收件人时无法用发件账号 IMAP 回读。 */
  to?: string;
}

/** 邮件日志列表查询参数 */
export interface MailLogListQuery {
  limit?: number;
  template?: string;
}

/** 邮件服务状态（不含授权码明文） */
export interface MailStatusResult {
  enabled: boolean;
  configured: boolean;
  passSet: boolean;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    from: string;
    fromName: string;
    timeoutMs: number;
  };
  imap: {
    host: string;
    port: number;
    secure: boolean;
    readback: boolean;
    timeoutMs: number;
  };
  /** 最近一次测试邮件 */
  lastTest: MailTestLog | null;
  /** 最近一次业务发信（验证码、通知等） */
  lastBusiness: MailTestLog | null;
}

/** 测试结果 */
export interface MailTestResult {
  mode: MailTestMode;
  status: "received" | "blocked" | "sent" | "verified" | "failed";
  testId: string | null;
  to: string;
  subject: string;
  messageId: string | null;
  smtpAccepted: boolean;
  received: boolean | null;
  /** 回读落点：INBOX / JUNK；未回读时为 null */
  receivedFolder: string | null;
  readbackEnabled: boolean;
  readbackError: string | null;
  error: string | null;
  elapsedMs: number;
  sentAt: string | null;
}

/** 邮件发送日志（测试/验证码/后续通知共用） */
export interface MailTestLog {
  id: number;
  userId: number | null;
  toEmail: string;
  subject: string;
  template: string;
  status: string;
  testId: string | null;
  messageId: string | null;
  error: string | null;
  createdAt: Date | string;
  sentAt: Date | string | null;
  receivedAt: Date | string | null;
}

/** 邮件发送参数 */
export interface MailSendOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  testId?: string;
  messageId?: string;
  headers?: Record<string, string>;
  ignoreEnabled?: boolean;
  userId?: number | null;
}

/** 邮件发送结果 */
export interface MailSendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  response: string;
}
