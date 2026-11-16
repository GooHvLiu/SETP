/**
 * ============================================================
 * 邮件服务路由（modules/mail/mail.route.ts）
 * ------------------------------------------------------------
 * 仅暴露给超级设置页：
 *   GET  /api/v1/super-admin/settings/mail/status  superAdmin:settings:list
 *   GET  /api/v1/super-admin/settings/mail/logs    superAdmin:settings:list
 *   POST /api/v1/super-admin/settings/mail/test    superAdmin:settings:update
 *
 * 测试接口默认 full：先 SMTP 发送，再用 IMAP 回读 testId；
 * 回读同时检查收件箱与垃圾箱，收到才算 received=true。
 * 前端请求超时建议 ≥ 70 秒。
 * ============================================================
 */

import { Router } from "express";
import mailController from "./mail.handler";
import { requireAuth, requirePermission } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

/**
 * @swagger
 * /api/v1/super-admin/settings/mail/status:
 *   get:
 *     summary: 获取邮件服务状态与最近一次测试/业务发信结果（需 superAdmin:settings:list）
 *     tags: [Config - 邮件服务]
 *     responses:
 *       200:
 *         description: 邮件服务状态；授权码只返回是否已设置
 *       10104:
 *         description: 无权限
 */
router.get(
  "/api/v1/super-admin/settings/mail/status",
  requireAuth,
  requirePermission("superAdmin:settings:list"),
  asyncHandler(async (req, res) => {
    const result = await mailController.getMailStatus();
    res.json(result);
  })
);

/**
 * @swagger
 * /api/v1/super-admin/settings/mail/logs:
 *   get:
 *     summary: 邮件日志列表（需 superAdmin:settings:list）
 *     description: 测试邮件与业务发信统一记录；template=verification_code 可只看验证码发信。
 *     tags: [Config - 邮件服务]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: template
 *         schema:
 *           type: string
 *         description: mail_test / verification_code；不传则返回全部
 *     responses:
 *       200:
 *         description: 按 id 倒序的邮件日志
 *       10104:
 *         description: 无权限
 */
router.get(
  "/api/v1/super-admin/settings/mail/logs",
  requireAuth,
  requirePermission("superAdmin:settings:list"),
  asyncHandler(async (req, res) => {
    const result = await mailController.listLogs(req.query as Record<string, unknown>);
    res.json(result);
  })
);

/**
 * @swagger
 * /api/v1/super-admin/settings/mail/test:
 *   post:
 *     summary: 测试邮件服务（需 superAdmin:settings:update）
 *     description: full=发送并 IMAP 回读；send=只发送；verify=只验证 SMTP 登录。收件人默认发件邮箱自己，可传 to 指定真实收件人；外部收件人无法用发件账号 IMAP 回读。
 *     tags: [Config - 邮件服务]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mode:
 *                 type: string
 *                 enum: [full, send, verify]
 *                 default: full
 *               to:
 *                 type: string
 *                 format: email
 *                 description: 测试收件人；不传时使用发件邮箱自己
 *     responses:
 *       200:
 *         description: 测试结果；received=true 表示已在收件箱或垃圾箱回读到测试邮件，receivedFolder 标明落点
 *       10104:
 *         description: 无权限
 *       90001:
 *         description: 邮件服务未配置
 *       90003:
 *         description: SMTP 登录失败
 *       90004:
 *         description: SMTP 连接失败
 *       90006:
 *         description: 邮件发送失败
 */
router.post(
  "/api/v1/super-admin/settings/mail/test",
  requireAuth,
  requirePermission("superAdmin:settings:update"),
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId;
    const result = await mailController.test(req.body || {}, userId);
    res.json(result);
  })
);

export default router;
