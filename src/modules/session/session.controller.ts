/**
 * ============================================================
 * 会话中心控制器（modules/session/session.controller.ts）— TSOA 版
 * ------------------------------------------------------------
 * 列表用页面权限码 superAdmin:sessionCenter:list；
 * 踢下线 / 批量踢下线用 superAdmin:session:revoke；
 * 清理用 superAdmin:session:cleanup。
 * 登录安全中心能力（设备、异常登录、锁定策略）并入本页，不单独建菜单。
 * ============================================================
 */

import { Body, Get, Path, Post, Query, Route, Security, Tags } from "tsoa";
import sessionService from "./session.service";
import { BaseController } from "../../base/BaseController";
import { SessionBatchRevokeResult, SessionCleanupResult, SessionListResult, SessionRevokeResult, SessionStatus } from "./session.model";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ApiResponse } from "../../types";

@Route("api/v1/super-admin/sessions")
@Tags("Ops - 会话中心")
export class SessionController extends BaseController {
  /**
   * 会话列表（分页 + 状态过滤 + 用户名模糊）
   * 概览统计按全量计算，不随筛选条件变化
   */
  @Get()
  @Security("bearerAuth", ["superAdmin:sessionCenter:list"])
  public async list(
    @Query() page: number = 1,
    @Query() pageSize: number = 10,
    @Query() status?: SessionStatus,
    @Query() keyword?: string
  ): Promise<ApiResponse<SessionListResult>> {
    const result = await sessionService.list({ page, pageSize, status, keyword });
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 踢下线单条会话
   * force=true 时同时提升令牌版本号，该用户全部设备立即失效
   */
  @Post("{id}/revoke")
  @Security("bearerAuth", ["superAdmin:session:revoke"])
  public async revoke(@Path() id: number, @Body() body: { force?: boolean }): Promise<ApiResponse<SessionRevokeResult>> {
    const result = await sessionService.revoke(Number(id), body?.force === true);
    return this.ok(result, MESSAGE_CODE.UPDATE_SUCCESS);
  }

  /**
   * 批量踢下线
   */
  @Post("revoke-batch")
  @Security("bearerAuth", ["superAdmin:session:revoke"])
  public async revokeBatch(@Body() body: { ids: number[]; force?: boolean }): Promise<ApiResponse<SessionBatchRevokeResult>> {
    const result = await sessionService.revokeBatch(body?.ids || [], body?.force === true);
    return this.ok(result, MESSAGE_CODE.UPDATE_SUCCESS);
  }

  /**
   * 清理过期/已吊销会话（默认保留 7 天）
   */
  @Post("cleanup")
  @Security("bearerAuth", ["superAdmin:session:cleanup"])
  public async cleanup(@Body() body: { beforeDays?: number }): Promise<ApiResponse<SessionCleanupResult>> {
    const result = await sessionService.cleanup(body?.beforeDays);
    return this.ok(result, MESSAGE_CODE.DELETE_SUCCESS);
  }
}
