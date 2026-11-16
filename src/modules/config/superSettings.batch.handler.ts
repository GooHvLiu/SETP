/**
 * ============================================================
 * 超级设置批量保存处理器（modules/config/superSettings.batch.handler.ts）
 * ------------------------------------------------------------
 * POST /api/v1/super-admin/settings/batch
 * 与单条 PUT 共用 superAdmin:settings:update 权限点；
 * 先整体校验，再单事务写入，避免前端逐条保存产生半套配置。
 * ============================================================
 */

import configService from "./config.service";
import { batchUpdateConfigSchema } from "./config.schema";
import type { BatchUpdateConfigBody } from "./config.model";
import { BaseController } from "../../base/BaseController";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ApiResponse } from "../../types";

class SuperSettingsBatchController extends BaseController {
  public async updateSettingsBatch(body: BatchUpdateConfigBody): Promise<ApiResponse> {
    const { error, value } = batchUpdateConfigSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    await configService.updateConfigs(value.items, "super");
    return this.ok(null, MESSAGE_CODE.SUCCESS);
  }
}

export default new SuperSettingsBatchController();
