/**
 * ============================================================
 * 操作日志控制器（modules/operateLog/operateLog.controller.ts）
 * ============================================================
 */

import { Route, Tags, Get, Query, Request, Security } from "tsoa";
import { Request as ExpressRequest } from "express";
import logCenterService from "../logCenter/logCenter.service";
import { BaseController } from "../../base/BaseController";
import { LogListResult } from "../logCenter/logCenter.model";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ApiResponse } from "../../types";

@Route("api/v1/operate-log")
@Tags("OperateLog - 操作日志")
export class OperateLogController extends BaseController {
  /**
   * 旧接口兼容别名：等价于 /api/v1/log-center/list?category=operation
   */
  @Get("list")
  @Security("bearerAuth", ["adminCenter:log:list"])
  public async getList(
    @Query() page: number = 1,
    @Query() pageSize: number = 20,
    @Request() request: ExpressRequest,
    @Query() module?: string,
    @Query() keyword?: string
  ): Promise<ApiResponse<LogListResult>> {
    const result = await logCenterService.getList(
      { page, pageSize, module, keyword, category: "operation" },
      (request as any).user?.isSuper === 1
    );
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }
}
