/**
 * ============================================================
 * 超级设置批量保存路由（modules/config/superSettings.batch.route.ts）
 * ------------------------------------------------------------
 * 单独成文件，避免 TSOA 版被装饰器扫描影响；
 * swagger 版通过 swagger-jsdoc 扫描 src/modules/**\/*.route.ts 自动收录。
 * ============================================================
 */

import { Router } from "express";
import superSettingsBatchController from "./superSettings.batch.handler";
import { requireAuth, requirePermission } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

/**
 * @swagger
 * /api/v1/super-admin/settings/batch:
 *   post:
 *     summary: 批量保存超级设置（需 superAdmin:settings:update）
 *     tags: [Config - 超级参数设置]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 maxItems: 50
 *                 items:
 *                   type: object
 *                   required: [key, value]
 *                   properties:
 *                     key: { type: string, maxLength: 100 }
 *                     value: { type: string, maxLength: 2000 }
 *     responses:
 *       200:
 *         description: 批量保存成功
 *       10104:
 *         description: 无权限
 *       30007:
 *         description: 参数不属于超级设置域
 *       30009:
 *         description: 参数不存在
 */
router.post(
  "/api/v1/super-admin/settings/batch",
  requireAuth,
  requirePermission("superAdmin:settings:update"),
  asyncHandler(async (req, res) => {
    const result = await superSettingsBatchController.updateSettingsBatch(req.body);
    res.json(result);
  })
);

export default router;
