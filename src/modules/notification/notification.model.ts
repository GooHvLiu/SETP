/**
 * ============================================================
 * 通知中心类型定义（modules/notification/notification.model.ts）
 * ============================================================
 */

import type { NotificationCategory, NotificationEmailStatus, NotificationType } from "../../constants/notification";

/** 通知记录（用户侧 / 批次详情共用） */
export interface NotificationDto {
  id: number;
  userId: number;
  category: NotificationCategory;
  title: string;
  content: string;
  /** 系统通知标题 key；管理员手写通知为 null */
  titleKey: string | null;
  /** 系统通知正文 key；管理员手写通知为 null */
  contentKey: string | null;
  type: NotificationType;
  data: Record<string, any>;
  source: string;
  link: string;
  senderId: number | null;
  batchId: string | null;
  templateKey: string | null;
  emailStatus: NotificationEmailStatus;
  emailError: string | null;
  isRead: number;
  readAt: Date | null;
  createdAt: Date;
}

/** 通知分页列表 */
export interface NotificationListResult {
  list: NotificationDto[];
  total: number;
  page: number;
  pageSize: number;
}

/** 统一发送入参（内部事件与管理员手动发送共用） */
export interface NotifyInput {
  userIds?: number[];
  roles?: string[];
  category?: NotificationCategory;
  type?: NotificationType;
  /** 手写标题/正文；系统通知改用 titleKey/contentKey 时传空串 */
  title?: string;
  content?: string;
  titleKey?: string;
  contentKey?: string;
  source?: string;
  link?: string;
  templateKey?: string;
  data?: Record<string, any>;
  sendEmail?: boolean;
  senderId?: number;
}

/** 管理员发送受众 */
export interface NotificationAudience {
  type: "all" | "role" | "user";
  roleCodes?: string[];
  userIds?: number[];
}

/** 管理员发送入参 */
export interface AdminSendNotificationBody {
  title: string;
  content: string;
  category?: NotificationCategory;
  type?: NotificationType;
  audience: NotificationAudience;
  link?: string;
  sendEmail?: boolean;
}

/** 发送结果 */
export interface NotificationSendResult {
  batchId: string;
  recipientCount: number;
  emailQueued: number;
  emailSkipped: number;
}

/** 通知批次列表项 */
export interface NotificationBatchItem {
  batchId: string;
  title: string;
  /** 系统通知批次标题 key；管理员手写批次为 null */
  titleKey: string | null;
  category: NotificationCategory;
  type: NotificationType;
  source: string;
  recipientCount: number;
  readCount: number;
  emailPending: number;
  emailSent: number;
  emailFailed: number;
  emailSkipped: number;
  createdAt: Date;
}

/** 批次列表结果 */
export interface NotificationBatchListResult {
  list: NotificationBatchItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 批次详情 */
export interface NotificationBatchDetailResult {
  batch: NotificationBatchItem;
  list: NotificationDto[];
  total: number;
  page: number;
  pageSize: number;
}
