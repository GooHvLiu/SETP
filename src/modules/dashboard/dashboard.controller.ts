/**
 * ============================================================
 * 看板趋势控制器（modules/dashboard/dashboard.controller.ts）
 * ------------------------------------------------------------
 * GET /api/v1/dashboard/trend
 * 权限码 dashBoard:list 已由 seed 菜单 /dashboard 绑定。
 * ============================================================
 */

import { Get, Route, Security, Tags } from "tsoa";
import dashboardService from "./dashboard.service";
import { DashboardTrend } from "./dashboard.model";
import { BaseController } from "../../base/BaseController";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ApiResponse } from "../../types";

@Route("api/v1/dashboard")
@Tags("Dashboard - 看板")
export class DashboardController extends BaseController {
  /**
   * 近七日操作条数，折线与柱状共用同一份数据
   */
  @Get("trend")
  @Security("bearerAuth", ["dashBoard:list"])
  public async trend(): Promise<ApiResponse<DashboardTrend>> {
    const result = await dashboardService.getTrend();
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }
}
