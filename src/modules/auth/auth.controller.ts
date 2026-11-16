/**
 * ============================================================
 * 认证控制器（modules/auth/auth.controller.ts）
 * ------------------------------------------------------------
 * TSOA 版本：类 + 装饰器，路由前缀 /api/v1/auth
 *
 * ★ TSOA 响应模式（重要）：
 *   成功 → return this.ok(data, msg)
 *   参数校验失败 → return this.fail(code, msg)
 *   业务错误 → throw new Error("XXX")，全局 errorHandler 统一处理
 *   需要登录用户 → 方法参数加 @Request() request，取 request.user
 * ============================================================
 */

import { Route, Tags, Post, Body, Request, Security, Response } from "tsoa";
import { Request as ExpressRequest } from "express";
import authService from "./auth.service";
import operateLogService from "../operateLog/operateLog.service";
import { BaseController } from "../../base/BaseController";
import { loginSchema, registerSchema, refreshSchema, changePasswordSchema } from "./auth.schema";
import { LoginResultDto, RefreshResultDto, ProfileResultDto, RegisterResultDto } from "./auth.model";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ERROR_CODE } from "../../constants/errorCode";
import { ApiResponse } from "../../types";

@Route("api/v1/auth")
@Tags("Auth - 权鉴中心")
export class AuthController extends BaseController {
  /**
   * 用户名密码登录（带验证码）
   * 登录前先调 GET /api/v1/captcha 获取验证码
   */
  @Post("login")
  @Security("")
  @Response<{ message: string }>(400, "验证码错误或用户不存在（业务码见响应体 code）")
  public async login(
    @Body() body: { username: string; password: string; captchaId: string; captchaCode: string },
    @Request() request: ExpressRequest
  ): Promise<ApiResponse<LoginResultDto>> {
    // 参数校验（Joi）
    const { error } = loginSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    const ip = request.ip || "";
    const userAgent = String(request.headers["user-agent"] || "").slice(0, 500);
    let result: LoginResultDto;
    try {
      result = await authService.login(body.username, body.password, body.captchaId, body.captchaCode);
    } catch (err) {
      // 登录失败流水：用户不存在 / 密码错误 / 锁定 / 待审核都按现成错误码落库
      try {
        await operateLogService.createLog({
          userId: null,
          username: body.username,
          category: "login",
          module: "auth",
          action: "LOGIN",
          result: "failed",
          reason: (err as Error)?.message || "LOGIN_FAILED",
          target: "",
          description: "POST /api/v1/auth/login",
          ip,
          userAgent,
        });
      } catch {
        // 流水失败不改变登录响应
      }
      throw err;
    }

    try {
      await operateLogService.createLog({
        userId: result.userInfo.id,
        username: result.userInfo.username,
        category: "login",
        module: "auth",
        action: "LOGIN",
        result: "success",
        reason: "",
        target: "",
        description: "POST /api/v1/auth/login",
        ip,
        userAgent,
      });
    } catch {
      // 同上
    }

    return this.ok(result, MESSAGE_CODE.LOGIN_SUCCESS);
  }

  /**
   * 刷新 Access Token
   * @param body.refreshToken 登录时返回的 refresh token
   */
  @Post("refresh")
  @Security("")
  public async refresh(@Body() body: { refreshToken: string }): Promise<ApiResponse<RefreshResultDto>> {
    const { error } = refreshSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    const result = await authService.refresh(body.refreshToken);
    return this.ok(result, MESSAGE_CODE.REFRESH_SUCCESS);
  }

  /**
   * 登出（吊销 refresh token）
   */
  @Post("logout")
  @Security("bearerAuth")
  public async logout(@Request() request: ExpressRequest): Promise<ApiResponse> {
    // request.user 由 auth 中间件注入（expressAuthentication 里挂载）
    const userId = request.user?.userId;
    if (!userId) {
      return this.fail(ERROR_CODE.UNAUTHORIZED);
    }

    await authService.logout(userId);
    try {
      await operateLogService.createLog({
        userId,
        username: request.user?.username || "",
        category: "login",
        module: "auth",
        action: "LOGOUT",
        result: "success",
        reason: "",
        target: "",
        description: "POST /api/v1/auth/logout",
        ip: request.ip || "",
        userAgent: String(request.headers["user-agent"] || "").slice(0, 500),
      });
    } catch {
      // 流水失败不影响登出
    }
    return this.ok(null, MESSAGE_CODE.LOGOUT_SUCCESS);
  }

  /**
   * 注册（自助注册需管理员审核，首次登录强制改密）
   */
  @Post("register")
  @Security("")
  public async register(
    @Body() body: { username: string; password: string; email: string; realName?: string }
  ): Promise<ApiResponse<RegisterResultDto>> {
    const { error } = registerSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    const result = await authService.register(body.username, body.password, body.email, body.realName);
    return this.ok(result, result.approvalRequired ? MESSAGE_CODE.REGISTER_PENDING_APPROVAL : MESSAGE_CODE.REGISTER_SUCCESS);
  }

  /**
   * 修改密码（首次登录强制改密也走该接口，必须提供旧密码）
   * 成功后强制重新登录
   */
  @Post("password/change")
  @Security("bearerAuth")
  public async changePassword(
    @Body() body: { oldPassword: string; newPassword: string },
    @Request() request: ExpressRequest
  ): Promise<ApiResponse<{ reloginRequired: boolean }>> {
    const userId = request.user?.userId;
    if (!userId) {
      return this.fail(ERROR_CODE.UNAUTHORIZED);
    }

    const { error } = changePasswordSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    const result = await authService.changePassword(userId, body.oldPassword, body.newPassword);
    return this.ok(result, MESSAGE_CODE.UPDATE_SUCCESS);
  }

  /**
   * 获取当前登录用户信息（含 role / roles / permissions / 注册时间 / 最后登录时间）
   */
  @Post("profile")
  @Security("bearerAuth")
  public async getProfile(@Request() request: ExpressRequest): Promise<ApiResponse<ProfileResultDto>> {
    const userId = request.user?.userId;
    if (!userId) {
      return this.fail(ERROR_CODE.UNAUTHORIZED);
    }

    const result = await authService.getProfile(userId);
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }
}
