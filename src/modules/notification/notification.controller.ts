/**
 * ============================================================
 * 通知中心控制器（modules/notification/notification.controller.ts）
 * ------------------------------------------------------------
 * 用户侧：list / unread-count / read / read-all
 * 管理侧：admin/batches、admin/batches/{batchId}、admin/send、
 *        admin/batches/{batchId}/retry-email（P1）
 * 注意：POST /api/v1/notification/create 已下线。
 * ============================================================
 */

import { Route, Tags, Get, Post, Query, Path, Body, Request, Security } from "tsoa";
import { Request as ExpressRequest } from "express";
import notificationService from "./notification.service";
import { BaseController } from "../../base/BaseController";
import {
  AdminSendNotificationBody,
  NotificationBatchDetailResult,
  NotificationBatchListResult,
  NotificationListResult,
  NotificationSendResult,
} from "./notification.model";
import {
  adminSendNotificationSchema,
  notificationBatchDetailSchema,
  notificationBatchListSchema,
  notificationListSchema,
} from "./notification.schema";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ERROR_CODE } from "../../constants/errorCode";
import { ApiResponse } from "../../types";

@Route("api/v1/notification")
@Tags("Notification - 消息通知")
export class NotificationController extends BaseController {
  /**
   * 当前用户的通知列表（分页，可按分类 / 级别筛选）
   */
  @Get("list")
  @Security("bearerAuth")
  public async getList(
    @Request() request: ExpressRequest,
    @Query() page: number = 1,
    @Query() pageSize: number = 10,
    @Query() isRead?: number,
    @Query() category?: string,
    @Query() type?: string
  ): Promise<ApiResponse<NotificationListResult>> {
    const userId = request.user?.userId;
    if (!userId) {
      return this.fail(ERROR_CODE.UNAUTHORIZED);
    }

    const { error } = notificationListSchema.validate({ page, pageSize, isRead, category, type });
    if (error) {
      return this.failJoi(error);
    }

    const result = await notificationService.getList(userId, { page, pageSize, isRead, category, type });
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 未读通知数量
   */
  @Get("unread-count")
  @Security("bearerAuth")
  public async getUnreadCount(@Request() request: ExpressRequest): Promise<ApiResponse<{ count: number }>> {
    const userId = request.user?.userId;
    if (!userId) {
      return this.fail(ERROR_CODE.UNAUTHORIZED);
    }

    const result = await notificationService.getUnreadCount(userId);
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 标记单条已读
   */
  @Post("read/{id}")
  @Security("bearerAuth")
  public async markRead(@Request() request: ExpressRequest, @Path() id: number): Promise<ApiResponse> {
    const userId = request.user?.userId;
    if (!userId) {
      return this.fail(ERROR_CODE.UNAUTHORIZED);
    }

    await notificationService.markRead(userId, id);
    return this.ok(null, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 全部标记已读
   */
  @Post("read-all")
  @Security("bearerAuth")
  public async markReadAll(@Request() request: ExpressRequest): Promise<ApiResponse> {
    const userId = request.user?.userId;
    if (!userId) {
      return this.fail(ERROR_CODE.UNAUTHORIZED);
    }

    await notificationService.markRead(userId);
    return this.ok(null, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 管理员：通知批次列表
   */
  @Get("admin/batches")
  @Security("bearerAuth", ["adminCenter:notice:manage"])
  public async getBatches(
    @Query() page: number = 1,
    @Query() pageSize: number = 10,
    @Query() category?: string,
    @Query() type?: string,
    @Query() source?: string,
    @Query() keyword?: string
  ): Promise<ApiResponse<NotificationBatchListResult>> {
    const { error } = notificationBatchListSchema.validate({ page, pageSize, category, type, source, keyword });
    if (error) {
      return this.failJoi(error);
    }

    const result = await notificationService.getBatches({ page, pageSize, category, type, source, keyword });
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 管理员：批次详情（按收件人列出，含已读与邮件状态）
   */
  @Get("admin/batches/{batchId}")
  @Security("bearerAuth", ["adminCenter:notice:manage"])
  public async getBatchDetail(
    @Path() batchId: string,
    @Query() page: number = 1,
    @Query() pageSize: number = 20
  ): Promise<ApiResponse<NotificationBatchDetailResult>> {
    const { error } = notificationBatchDetailSchema.validate({ page, pageSize });
    if (error) {
      return this.failJoi(error);
    }

    const result = await notificationService.getBatchDetail(batchId, { page, pageSize });
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 管理员：发送通知（受众 all / role / user，禁止定向 superAdmin）
   */
  @Post("admin/send")
  @Security("bearerAuth", ["adminCenter:notice:send"])
  public async sendByAdmin(
    @Body() body: AdminSendNotificationBody,
    @Request() request: ExpressRequest
  ): Promise<ApiResponse<NotificationSendResult>> {
    const { error } = adminSendNotificationSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    const senderId = request.user?.userId;
    if (!senderId) {
      return this.fail(ERROR_CODE.UNAUTHORIZED);
    }

    const result = await notificationService.sendByAdmin(body, senderId);
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 管理员：重试批次内失败邮件（P1）
   */
  @Post("admin/batches/{batchId}/retry-email")
  @Security("bearerAuth", ["adminCenter:notice:manage"])
  public async retryFailedEmails(@Path() batchId: string): Promise<ApiResponse> {
    const result = await notificationService.retryFailedEmails(batchId);
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }
}
