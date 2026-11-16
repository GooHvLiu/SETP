/**
 * ============================================================
 * 健康检查控制器（modules/health/health.controller.ts）— TSOA 版
 * ------------------------------------------------------------
 * 列表接口用页面权限码 superAdmin:healthCheck:list（进入页面即可看结果）
 * 立即探测用按钮权限码 superAdmin:health:probe
 * ============================================================
 */

import { Body, Get, Post, Query, Route, Security, Tags } from "tsoa";
import healthService from "./health.service";
import { BaseController } from "../../base/BaseController";
import { HealthProbeBody, HealthReport } from "./health.model";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ApiResponse } from "../../types";

@Route("api/v1/super-admin/health")
@Tags("Ops - 健康检查")
export class HealthController extends BaseController {
  /**
   * 最近一次检查结果（服务端即时执行一遍并返回，前端进入页面时调用）
   * keys 为逗号分隔的检查项，如 database,memory
   */
  @Get("checks")
  @Security("bearerAuth", ["superAdmin:healthCheck:list"])
  public async getChecks(@Query() keys?: string): Promise<ApiResponse<HealthReport>> {
    const keyList = keys
      ? keys
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined;
    const result = await healthService.run(keyList);
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 立即探测（可指定检查项）
   */
  @Post("probe")
  @Security("bearerAuth", ["superAdmin:health:probe"])
  public async probe(@Body() body: HealthProbeBody): Promise<ApiResponse<HealthReport>> {
    const result = await healthService.run(body?.keys);
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }
}
