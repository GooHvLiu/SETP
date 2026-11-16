/**
 * ============================================================
 * 运维任务控制器（modules/opsTask/opsTask.controller.ts）— TSOA 版
 * ------------------------------------------------------------
 * 列表用页面权限码 superAdmin:taskCenter:list；
 * 普通任务执行用 superAdmin:task:run；
 * 种子重建用 superAdmin:task:run + superAdmin:task:danger 双码。
 * ============================================================
 */

import { Body, Get, Path, Post, Route, Security, Tags } from "tsoa";
import opsTaskService from "./opsTask.service";
import { BaseController } from "../../base/BaseController";
import { OpsReseedBody, OpsTaskListResult, OpsTaskRunResult } from "./opsTask.model";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ERROR_CODE } from "../../constants/errorCode";
import { ApiResponse } from "../../types";

@Route("api/v1/super-admin/ops")
@Tags("Ops - 运维任务")
export class OpsTaskController extends BaseController {
  /**
   * 任务清单（含最近一次执行记录）
   */
  @Get("tasks")
  @Security("bearerAuth", ["superAdmin:taskCenter:list"])
  public async list(): Promise<ApiResponse<OpsTaskListResult>> {
    return this.ok(opsTaskService.list(), MESSAGE_CODE.SUCCESS);
  }

  /**
   * 执行普通任务：session-cleanup / help-reindex / db-backup
   * 危险任务不允许走本接口，需使用 POST ops/reseed
   */
  @Post("tasks/{key}/run")
  @Security("bearerAuth", ["superAdmin:task:run"])
  public async run(@Path() key: string): Promise<ApiResponse<OpsTaskRunResult | null>> {
    const result = await opsTaskService.run(key);
    if (result.status === "failed") {
      return this.failWithData(ERROR_CODE.TASK_EXEC_FAILED, result, undefined, {
        reason: String(result.params?.reason ?? ""),
      });
    }
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 种子数据重建（危险任务，需 RESEED 二次确认）
   */
  @Post("reseed")
  @Security("bearerAuth", ["superAdmin:task:run", "superAdmin:task:danger"])
  public async reseed(@Body() body: OpsReseedBody): Promise<ApiResponse<OpsTaskRunResult | null>> {
    const result = await opsTaskService.runReseed(body?.confirm);
    if (result.status === "failed") {
      return this.failWithData(ERROR_CODE.TASK_EXEC_FAILED, result, undefined, {
        reason: String(result.params?.reason ?? ""),
      });
    }
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }
}
