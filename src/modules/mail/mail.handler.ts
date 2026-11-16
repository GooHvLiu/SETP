/**
 * ============================================================
 * 邮件服务处理器（modules/mail/mail.handler.ts）
 * ------------------------------------------------------------
 * 供超级设置页使用：
 *   GET  /api/v1/super-admin/settings/mail/status
 *   GET  /api/v1/super-admin/settings/mail/logs
 *   POST /api/v1/super-admin/settings/mail/test
 *
 * 说明：测试接口最长等待 60 秒（IMAP 回读），前端请求超时需大于该值。
 * ============================================================
 */

import mailService from "./mail.service";
import { mailLogListSchema, mailTestSchema } from "./mail.schema";
import type { MailStatusResult, MailTestBody, MailTestResult, MailLogListQuery, MailTestLog } from "./mail.model";
import { BaseController } from "../../base/BaseController";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ApiResponse } from "../../types";

class MailController extends BaseController {
  /** 读取邮件服务状态与最近一次测试/业务发信结果 */
  public async getMailStatus(): Promise<ApiResponse<MailStatusResult>> {
    const result = await mailService.getStatus();
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /** 读取邮件日志：测试邮件与业务发信统一查看 */
  public async listLogs(query: MailLogListQuery): Promise<ApiResponse<MailTestLog[]>> {
    const { error, value } = mailLogListSchema.validate(query || {});
    if (error) {
      return this.failJoi(error);
    }

    const result = await mailService.listLogs(value.limit, value.template);
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /** 点击「测试」：默认 full，发送并 IMAP 回读确认；可指定收件人 */
  public async test(body: MailTestBody, userId?: number | null): Promise<ApiResponse<MailTestResult>> {
    const { error, value } = mailTestSchema.validate(body || {});
    if (error) {
      return this.failJoi(error);
    }

    const result = await mailService.test(value.mode, userId, value.to);
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }
}

export default new MailController();
