/**
 * ============================================================
 * 系统配置控制器（modules/config/config.controller.ts）
 * ============================================================
 */

import { Route, Tags, Get, Put, Body, Security } from "tsoa";
import configService from "./config.service";
import { BaseController } from "../../base/BaseController";
import { ConfigDto } from "./config.model";
import { updateConfigSchema } from "./config.schema";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ApiResponse } from "../../types";

@Route("api/v1/config")
@Tags("Config - 系统参数设置")
export class ConfigController extends BaseController {
  /**
   * 匿名可读配置子集（站点名、描述、版权、默认语言、法务信息、自助注册开关 register_enabled（共 11 项））
   * 登录页在未持有 token 时调用，不要求 Authorization。
   */
  @Get("public")
  public async getPublicConfig(): Promise<ApiResponse<ConfigDto[]>> {
    const result = await configService.getPublicConfig();
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 获取常规系统设置可读参数（登录即可）
   * 只返回 read_scope=all 的键；super 域中站点/法务等公开项也在其中，
   * 前端可按 configScope 过滤出系统设置页要展示的部分。
   */
  @Get("all")
  @Security("bearerAuth")
  public async getAllConfig(): Promise<ApiResponse<ConfigDto[]>> {
    const result = await configService.getAllConfig();
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 更新常规系统设置参数（仅 system 域）
   */
  @Put()
  @Security("bearerAuth", ["systemSettings:config:update"])
  public async updateConfig(@Body() body: { key: string; value: string }): Promise<ApiResponse> {
    const { error } = updateConfigSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    await configService.updateConfig(body.key, body.value, "system");
    return this.ok(null, MESSAGE_CODE.SUCCESS);
  }
}
