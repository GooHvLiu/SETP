/**
 * ============================================================
 * 日志中心控制器（modules/logCenter/logCenter.controller.ts）
 * ------------------------------------------------------------
 * GET  /api/v1/log-center/list     三类日志统一查询（全局）
 * GET  /api/v1/log-center/my-list  当前登录用户个人日志
 * GET  /api/v1/log-center/summary  24h / 7d / 30d 概览
 * POST /api/v1/log-center/cleanup  超管手动清理
 * 旧 GET /api/v1/operate-log/list 保留兼容别名（仅 operation）。
 * ============================================================
 */

import { Route, Tags, Get, Post, Query, Body, Request, Security } from "tsoa";
import { Request as ExpressRequest } from "express";
import logCenterService from "./logCenter.service";
import { BaseController } from "../../base/BaseController";
import { LogCleanupResult, LogListResult, LogSummaryResult } from "./logCenter.model";
import { logCleanupSchema, logListSchema, logSummarySchema, myLogListSchema } from "./logCenter.schema";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ERROR_CODE } from "../../constants/errorCode";
import { ApiResponse } from "../../types";

@Route("api/v1/log-center")
@Tags("LogCenter - 日志中心")
export class LogCenterController extends BaseController {
  /**
   * 统一日志列表（category=operation/login/mail）
   */
  @Get("list")
  @Security("bearerAuth", ["adminCenter:log:list"])
  public async getList(
    @Request() request: ExpressRequest,
    @Query() page: number = 1,
    @Query() pageSize: number = 20,
    @Query() category?: string,
    @Query() module?: string,
    @Query() action?: string,
    @Query() result?: string,
    @Query() username?: string,
    @Query() keyword?: string,
    @Query() from?: string,
    @Query() to?: string
  ): Promise<ApiResponse<LogListResult>> {
    const { error } = logListSchema.validate({
      page,
      pageSize,
      category,
      module,
      action,
      result,
      username,
      keyword,
      from,
      to,
    });
    if (error) {
      return this.failJoi(error);
    }

    const data = await logCenterService.getList(
      { page, pageSize, category, module, action, result, username, keyword, from, to },
      (request as any).user?.isSuper === 1
    );
    return this.ok(data, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 个人日志列表（只返回当前登录用户的 operation/login/mail）
   * 查询范围由认证主体决定，不接受 userId / username / scope。
   */
  @Get("my-list")
  @Security("bearerAuth", ["dataSearch:list"])
  public async getMyList(
    @Request() request: ExpressRequest,
    @Query() page: number = 1,
    @Query() pageSize: number = 20,
    @Query() category?: string,
    @Query() module?: string,
    @Query() action?: string,
    @Query() result?: string,
    @Query() keyword?: string,
    @Query() from?: string,
    @Query() to?: string
  ): Promise<ApiResponse<LogListResult>> {
    const { error } = myLogListSchema.validate({
      page,
      pageSize,
      category,
      module,
      action,
      result,
      keyword,
      from,
      to,
    });
    if (error) {
      return this.failJoi(error);
    }

    const userId = request.user?.userId;
    if (!userId) {
      return this.fail(ERROR_CODE.UNAUTHORIZED);
    }

    const data = await logCenterService.getMyList({ page, pageSize, category, module, action, result, keyword, from, to }, userId);
    return this.ok(data, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 概览（默认最近 24 小时）
   */
  @Get("summary")
  @Security("bearerAuth", ["adminCenter:log:list"])
  public async getSummary(
    @Request() request: ExpressRequest,
    @Query() range: "24h" | "7d" | "30d" = "24h"
  ): Promise<ApiResponse<LogSummaryResult>> {
    const { error } = logSummarySchema.validate({ range });
    if (error) {
      return this.failJoi(error);
    }

    const data = await logCenterService.getSummary(range, (request as any).user?.isSuper === 1);
    return this.ok(data, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 手动清理（仅超管；confirm 必填 CLEANUP）
   */
  @Post("cleanup")
  @Security("bearerAuth", ["adminCenter:log:cleanup"])
  public async cleanup(@Body() body: { beforeDays?: number; confirm: string }): Promise<ApiResponse<LogCleanupResult>> {
    const { error } = logCleanupSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    const data = await logCenterService.cleanup(body);
    return this.ok(data, MESSAGE_CODE.SUCCESS);
  }
}
