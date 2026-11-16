/**
 * ============================================================
 * 通知中心统一口径（constants/notification.ts）
 * ------------------------------------------------------------
 * 分类（category）表达通知属于哪条业务线：
 *   system / security / business / announcement
 * 级别沿用通知表现有的 type 字段：
 *   info / success / warning / error
 * 邮件投递状态（emailStatus）：
 *   none / pending / sent / failed / skipped
 * ============================================================
 */

export const NOTIFICATION_CATEGORY = {
  SYSTEM: "system",
  SECURITY: "security",
  BUSINESS: "business",
  ANNOUNCEMENT: "announcement",
} as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORY)[keyof typeof NOTIFICATION_CATEGORY];

export const NOTIFICATION_TYPE = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export const NOTIFICATION_EMAIL_STATUS = {
  NONE: "none",
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
  SKIPPED: "skipped",
} as const;

export type NotificationEmailStatus = (typeof NOTIFICATION_EMAIL_STATUS)[keyof typeof NOTIFICATION_EMAIL_STATUS];

/** 分类中文名：仅供服务端邮件模板渲染，不进入任何 API 响应；前端展示请按 category 值自行 i18n */
export const NOTIFICATION_CATEGORY_LABEL: Record<NotificationCategory, string> = {
  system: "系统通知",
  security: "安全通知",
  business: "业务通知",
  announcement: "公告",
};

export function isNotificationCategory(value: unknown): value is NotificationCategory {
  return Object.values(NOTIFICATION_CATEGORY).includes(value as NotificationCategory);
}

export function isNotificationType(value: unknown): value is NotificationType {
  return Object.values(NOTIFICATION_TYPE).includes(value as NotificationType);
}

/** 邮件模板名：notify_<category>；mail_logs.template 按此归类 */
export function notificationMailTemplate(category: NotificationCategory): string {
  return `notify_${category}`;
}
