/**
 * ============================================================
 * 超级设置控制器（modules/config/superSettings.controller.ts）
 * ------------------------------------------------------------
 * 独立入口，与常规系统设置接口物理隔离：
 *   GET  /api/v1/super-admin/settings   superAdmin:settings:list
 *   PUT  /api/v1/super-admin/settings   superAdmin:settings:update
 * 只读写注册表中 scope=super 的参数，跨域写入由 service 拒绝。
 * ============================================================
 */

import { Body, Get, Put, Route, Security, Tags } from "tsoa";
import configService from "./config.service";
import { BaseController } from "../../base/BaseController";
import { ConfigDto } from "./config.model";
import { updateConfigSchema } from "./config.schema";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ApiResponse } from "../../types";

@Route("api/v1/super-admin/settings")
@Tags("Config - 超级参数设置")
export class SuperSettingsController extends BaseController {
  /**
   * 获取超级设置全量参数（config_scope=super）
   */
  @Get()
  @Security("bearerAuth", ["superAdmin:settings:list"])
  public async getSettings(): Promise<ApiResponse<ConfigDto[]>> {
    const result = await configService.getSuperConfig();
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 更新超级设置参数（仅 super 域）
   */
  @Put()
  @Security("bearerAuth", ["superAdmin:settings:update"])
  public async updateSettings(@Body() body: { key: string; value: string }): Promise<ApiResponse> {
    const { error } = updateConfigSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    await configService.updateConfig(body.key, body.value, "super");
    return this.ok(null, MESSAGE_CODE.SUCCESS);
  }
}
