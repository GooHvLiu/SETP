/**
 * ============================================================
 * 运行指标控制器（modules/metrics/metrics.controller.ts）— TSOA 版
 * ------------------------------------------------------------
 * 查询用页面权限码 superAdmin:metricsCenter:list；
 * 重置计数用按钮权限码 superAdmin:metrics:reset。
 * ============================================================
 */

import { Get, Post, Query, Route, Security, Tags } from "tsoa";
import metricsService from "./metrics.service";
import { BaseController } from "../../base/BaseController";
import { MetricsOverview, MetricsRange, MetricsResetResult } from "./metrics.model";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ApiResponse } from "../../types";

@Route("api/v1/super-admin/metrics")
@Tags("Ops - 运行指标")
export class MetricsController extends BaseController {
  /**
   * 指标总览（区间汇总 + 实时内存 + 趋势序列）
   * range 支持 1h / 6h / 24h，默认 1h
   */
  @Get("overview")
  @Security("bearerAuth", ["superAdmin:metricsCenter:list"])
  public async overview(@Query() range: MetricsRange = "1h"): Promise<ApiResponse<MetricsOverview>> {
    const result = metricsService.getOverview(range);
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 重置计数（只清内存分桶，不影响日志与数据库）
   */
  @Post("reset")
  @Security("bearerAuth", ["superAdmin:metrics:reset"])
  public async reset(): Promise<ApiResponse<MetricsResetResult>> {
    const result = metricsService.reset();
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }
}
