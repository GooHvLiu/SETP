/**
 * ============================================================
 * 图形验证码控制器（modules/captcha/captcha.controller.ts）
 * ============================================================
 */

import { Route, Tags, Get, Security, Response } from "tsoa";
import captchaService from "./captcha.service";
import { BaseController } from "../../base/BaseController";
import { CaptchaResultDto } from "./captcha.model";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ApiResponse } from "../../types";

@Route("api/v1/captcha")
@Tags("Captcha - 验证码")
export class CaptchaController extends BaseController {
  /**
   * 获取图形验证码（登录前先调用）
   */
  @Get()
  @Security("")
  @Response<{ message: string }>(200, "返回 captchaId + SVG 图片")
  public async getCaptcha(): Promise<ApiResponse<CaptchaResultDto>> {
    const result = captchaService.generateCaptcha();

    // 非生产环境附带明文验证码答案（devCode），供自动化测试走真实登录闭环；
    // 生产环境（NODE_ENV=production）绝不返回，保持图形验证码的防爆破语义
    const resp: CaptchaResultDto = {
      captchaId: result.captchaId,
      img: result.img,
      expiresIn: result.expiresIn,
    };
    if (process.env.NODE_ENV !== "production") {
      resp.devCode = result.code;
    }

    return this.ok(resp, MESSAGE_CODE.CAPTCHA_GENERATED);
  }
}
