/**
 * ============================================================
 * 忘记密码路由（modules/auth/auth.recovery.route.ts）
 * ------------------------------------------------------------
 * 手写 Router，四个模板共用同一套入口，不依赖 TSOA 重新生成：
 *   POST /api/v1/auth/password/forgot  申请验证码
 *   POST /api/v1/auth/password/reset   提交验证码 + 新密码
 *
 * 两个接口均为公开接口，按 IP 严格限流（默认 10 次/分钟）。
 * ============================================================
 */

import { Router } from "express";
import authRecoveryHandler from "./auth.recovery.handler";
import { loginRateLimitMiddleware } from "../../middleware/rateLimit.middleware";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

/**
 * @swagger
 * /api/v1/auth/password/forgot:
 *   post:
 *     summary: 申请重置密码验证码
 *     description: 用户名 + 邮箱必须同时匹配；账号不存在或邮箱不匹配时直接返回业务错误，不再进入验证码步骤。
 *     tags: [Auth - 权鉴中心]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, captchaId, captchaCode]
 *             properties:
 *               username: { type: string, example: admin }
 *               email: { type: string, example: admin@example.com }
 *               captchaId: { type: string, format: uuid }
 *               captchaCode: { type: string, example: a1b2 }
 *     responses:
 *       200:
 *         description: 验证码已提交；邮件发送成功与否不改变该结构
 *       400:
 *         description: 图形验证码错误或已过期（业务码 10201 / 10202）、用户名与邮箱不匹配（业务码 20012）或参数校验失败（PARAM_INVALID）
 *       429:
 *         description: 重发冷却未结束（业务码 20018，params.retryAfterSeconds），或登录限流触发（业务码 10106）
 */
router.post(
  "/api/v1/auth/password/forgot",
  loginRateLimitMiddleware,
  asyncHandler(async (req, res) => {
    const result = await authRecoveryHandler.requestPasswordReset(req.body);
    res.json(result);
  })
);

/**
 * @swagger
 * /api/v1/auth/password/reset:
 *   post:
 *     summary: 提交验证码并重置密码
 *     description: 验证码 10 分钟内有效，最多尝试 5 次；成功后 tokenVersion +1 并吊销全部 refresh token，需要重新登录。
 *     tags: [Auth - 权鉴中心]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, code, newPassword]
 *             properties:
 *               username: { type: string, example: admin }
 *               email: { type: string, example: admin@example.com }
 *               code: { type: string, example: "123456" }
 *               newPassword: { type: string, example: "newPass123" }
 *     responses:
 *       200:
 *         description: PASSWORD_RESET_SUCCESS；返回 username，不自动登录
 *       400:
 *         description: 验证码错误或已过期（20009）、尝试次数过多（20010）、密码强度不足（20005）、参数校验失败
 *       429:
 *         description: 请求过于频繁（业务码 10106）
 */
router.post(
  "/api/v1/auth/password/reset",
  loginRateLimitMiddleware,
  asyncHandler(async (req, res) => {
    const result = await authRecoveryHandler.resetPassword(req.body);
    res.json(result);
  })
);

export default router;
