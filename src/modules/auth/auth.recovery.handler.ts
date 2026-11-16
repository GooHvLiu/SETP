/**
 * ============================================================
 * 忘记密码处理器（modules/auth/auth.recovery.handler.ts）
 * ------------------------------------------------------------
 * 公开接口，不依赖登录态：
 *   POST /api/v1/auth/password/forgot  申请验证码
 *   POST /api/v1/auth/password/reset   提交验证码 + 新密码
 *
 * 申请接口先校验账号与邮箱，不匹配直接返回业务错误；重发冷却期返回 429 + PASSWORD_RESET_TOO_FREQUENT，并带 retryAfterSeconds。
 * 具体发信失败只写运行日志，不改变响应。
 * ============================================================
 */

import authService from "./auth.service";
import { requestPasswordResetSchema, resetPasswordSchema } from "./auth.schema";
import { BaseController } from "../../base/BaseController";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ApiResponse } from "../../types";

export interface PasswordResetRequestDto {
  username: string;
  email: string;
  captchaId: string;
  captchaCode: string;
}

export interface PasswordResetConfirmDto {
  username: string;
  email: string;
  code: string;
  newPassword: string;
}

class AuthRecoveryHandler extends BaseController {
  /** 申请重置密码验证码 */
  public async requestPasswordReset(body: PasswordResetRequestDto): Promise<ApiResponse<{ expiresMinutes: number }>> {
    const { error, value } = requestPasswordResetSchema.validate(body || {});
    if (error) {
      return this.failJoi(error);
    }

    const result = await authService.requestPasswordReset(value.username, value.email, value.captchaId, value.captchaCode);
    return this.ok(result, MESSAGE_CODE.PASSWORD_RESET_CODE_SENT);
  }

  /** 验证码校验通过后重置密码 */
  public async resetPassword(body: PasswordResetConfirmDto): Promise<ApiResponse<{ username: string }>> {
    const { error, value } = resetPasswordSchema.validate(body || {});
    if (error) {
      return this.failJoi(error);
    }

    const result = await authService.resetPassword(value.username, value.email, value.code, value.newPassword);
    return this.ok(result, MESSAGE_CODE.PASSWORD_RESET_SUCCESS);
  }
}

export default new AuthRecoveryHandler();
