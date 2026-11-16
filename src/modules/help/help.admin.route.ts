/**
 * ============================================================
 * 帮助中心管理端路由（modules/help/help.admin.route.ts）
 * ------------------------------------------------------------
 * 超级面板 / 知识管理中心的 17 个管理接口（手写 16 个 + reindex 走 TSOA + 旧 docs 兼容）。
 * 与 tsoa 生成路由并存：本文件只挂在手写 Router 上。
 * ============================================================
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import { asyncHandler } from "@src/utils/asyncHandler";
import { requireAuth, requirePermission } from "@src/middleware/auth.middleware";
import { CODE_TO_MSG, ERROR_CODE } from "@src/constants/errorCode";
import { HELP_MAX_CONTENT_SIZE, HELP_MAX_IMAGE_SIZE, HELP_TMP_DIR } from "@src/config/help.config";
import helpAdminService from "./help.admin.service";

const router = Router();

/** 上传临时目录：HELP_DATA_DIR/.tmp（写完即被移到目标位置） */
fs.mkdirSync(HELP_TMP_DIR, { recursive: true });

/** 统一成功响应壳 */
function ok<T>(data: T) {
  return { code: ERROR_CODE.SUCCESS, msg: CODE_TO_MSG[ERROR_CODE.SUCCESS], data, timestamp: Date.now() };
}

/** 文本字段读取：query 优先，其次 body */
function textField(req: Request, key: string): string | undefined {
  const fromQuery = req.query[key];
  const fromBody = (req.body || {})[key];
  const value = fromQuery !== undefined ? fromQuery : fromBody;
  if (Array.isArray(value)) return String(value[0] || "") || undefined;
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

/** body 文本原值：保留空串，用于清空可选字段 */
function bodyText(req: Request, key: string): string | undefined {
  const value = (req.body || {})[key];
  if (value === undefined || value === null) return undefined;
  return String(value);
}

/** multer 临时落盘 */
function makeUploader(fileFilter: multer.Options["fileFilter"], maxSize: number): multer.Multer {
  return multer({
    storage: multer.diskStorage({
      destination: HELP_TMP_DIR,
      filename: (_req, file, cb) => {
        cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
      },
    }),
    fileFilter,
    limits: { fileSize: maxSize },
  });
}

/** 文档上传：md / pdf */
const contentUpload = makeUploader((_req, file, cb) => {
  const lower = file.originalname.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".pdf")) return cb(null, true);
  cb(new Error("FILE_TYPE_NOT_ALLOWED"));
}, HELP_MAX_CONTENT_SIZE);

/** 图片上传：png / jpg / jpeg / webp / gif，禁 svg */
const assetUpload = makeUploader((_req, file, cb) => {
  const lower = file.originalname.toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].some((ext) => lower.endsWith(ext))) return cb(null, true);
  cb(new Error("FILE_TYPE_NOT_ALLOWED"));
}, HELP_MAX_IMAGE_SIZE);

/** 把 multer 的错误交给全局错误处理 */
function singleUpload(instance: multer.Multer, field: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    instance.single(field)(req, res, (err: unknown) => {
      if (err) return next(err);
      next();
    });
  };
}

/**
 * 上传正文按槽位状态分权：
 * 空槽位（无文件）要求 help:doc:create，已有文件要求 help:doc:update。
 * 必须在 multer 之前执行，避免无权限请求先把临时文件落盘。
 */
function requireSlotContentPermission() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const slot = await helpAdminService.getSlot(textField(req, "locale"), req.params.docKey);
      const permission = slot.status === "empty" ? "superAdmin:help:doc:create" : "superAdmin:help:doc:update";
      return requirePermission(permission)(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

/** 文档位列表 */
router.get(
  "/api/v1/help/admin/locales",
  requireAuth,
  requirePermission("superAdmin:knowledgeCenter:list"),
  asyncHandler(async (_req, res) => {
    res.json(ok(await helpAdminService.listLocales()));
  })
);

/** 初始化语言目录 + 空 manifest */
router.post(
  "/api/v1/help/admin/locales/:locale/init",
  requireAuth,
  requirePermission("superAdmin:help:slot:manage"),
  asyncHandler(async (req, res) => {
    const title = textField(req, "title");
    res.json(ok(await helpAdminService.initLocale(req.params.locale, title)));
  })
);

/** 修改语言展示名 / 目录名（目录改名后需人工同步前端语言包与语言码） */
router.patch(
  "/api/v1/help/admin/locales/:locale",
  requireAuth,
  requirePermission("superAdmin:help:slot:manage"),
  asyncHandler(async (req, res) => {
    res.json(
      ok(
        await helpAdminService.updateLocale(req.params.locale, {
          newLocale: textField(req, "newLocale"),
          title: bodyText(req, "title"),
        })
      )
    );
  })
);

/** 删除语言目录 + 索引（物理删除，不保留备份） */
router.delete(
  "/api/v1/help/admin/locales/:locale",
  requireAuth,
  requirePermission("superAdmin:help:slot:manage"),
  asyncHandler(async (req, res) => {
    res.json(ok(await helpAdminService.deleteLocale(req.params.locale, textField(req, "confirm"))));
  })
);

/** 管理树 + orphan + 统计 */
router.get(
  "/api/v1/help/admin/slots",
  requireAuth,
  requirePermission("superAdmin:knowledgeCenter:list"),
  asyncHandler(async (req, res) => {
    res.json(ok(await helpAdminService.getSlots(textField(req, "locale"))));
  })
);

/** 可枚举文件清单 */
router.get(
  "/api/v1/help/admin/slots/file-options",
  requireAuth,
  requirePermission("superAdmin:help:slot:manage"),
  asyncHandler(async (req, res) => {
    res.json(
      ok(
        await helpAdminService.listFileOptions({
          locale: textField(req, "locale"),
          keyword: textField(req, "keyword"),
          contentType: textField(req, "contentType"),
          page: Number(textField(req, "page")) || 1,
          pageSize: Number(textField(req, "pageSize")) || 20,
        })
      )
    );
  })
);

/** 新建文档位（只写 manifest） */
router.post(
  "/api/v1/help/admin/slots",
  requireAuth,
  requirePermission("superAdmin:help:slot:manage"),
  asyncHandler(async (req, res) => {
    res.json(ok(await helpAdminService.createSlot(req.body || {})));
  })
);

/** 更新文档位展示信息 */
router.put(
  "/api/v1/help/admin/slots/:docKey",
  requireAuth,
  requirePermission("superAdmin:help:slot:manage"),
  asyncHandler(async (req, res) => {
    res.json(ok(await helpAdminService.updateSlot(textField(req, "locale"), req.params.docKey, req.body || {})));
  })
);

/** 删除文档位（manifest + 文件 + 索引） */
router.delete(
  "/api/v1/help/admin/slots/:docKey",
  requireAuth,
  requirePermission("superAdmin:help:slot:manage"),
  asyncHandler(async (req, res) => {
    const confirm = textField(req, "confirm");
    res.json(ok(await helpAdminService.deleteSlot(textField(req, "locale"), req.params.docKey, confirm)));
  })
);

/** 文档位详情 */
router.get(
  "/api/v1/help/admin/slots/:docKey",
  requireAuth,
  requirePermission("superAdmin:knowledgeCenter:list"),
  asyncHandler(async (req, res) => {
    res.json(ok(await helpAdminService.getSlot(textField(req, "locale"), req.params.docKey)));
  })
);

/** 文档正文 */
router.get(
  "/api/v1/help/admin/slots/:docKey/content",
  requireAuth,
  requirePermission("superAdmin:knowledgeCenter:list"),
  asyncHandler(async (req, res) => {
    res.json(ok(await helpAdminService.getSlotContent(textField(req, "locale"), req.params.docKey)));
  })
);

/** 文档原文件 */
router.get(
  "/api/v1/help/admin/slots/:docKey/file",
  requireAuth,
  requirePermission("superAdmin:knowledgeCenter:list"),
  asyncHandler(async (req, res) => {
    const file = await helpAdminService.getSlotFile(textField(req, "locale"), req.params.docKey);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.fileName)}"`);
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(file.absolutePath);
  })
);

/** 上传/替换文档正文（empty 时需 create 权限，否则 update 权限） */
router.put(
  "/api/v1/help/admin/slots/:docKey/content",
  requireAuth,
  requireSlotContentPermission(),
  singleUpload(contentUpload, "file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new Error("PARAM_MISSING");
    res.json(
      ok(
        await helpAdminService.saveSlotContent({
          locale: textField(req, "locale"),
          docKey: req.params.docKey,
          tempFile: req.file.path,
          originalName: req.file.originalname,
          size: req.file.size,
          baseHash: textField(req, "baseHash"),
        })
      )
    );
  })
);

/** 清空文档位内容（保留槽位） */
router.delete(
  "/api/v1/help/admin/slots/:docKey/content",
  requireAuth,
  requirePermission("superAdmin:help:doc:delete"),
  asyncHandler(async (req, res) => {
    const confirm = textField(req, "confirm");
    res.json(ok(await helpAdminService.deleteSlotContent(textField(req, "locale"), req.params.docKey, confirm)));
  })
);

/** 上传图片资源 */
router.post(
  "/api/v1/help/admin/assets",
  requireAuth,
  requirePermission("superAdmin:help:doc:update"),
  singleUpload(assetUpload, "file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new Error("PARAM_MISSING");
    res.json(
      ok(
        await helpAdminService.saveAsset({
          tempFile: req.file.path,
          originalName: req.file.originalname,
          size: req.file.size,
        })
      )
    );
  })
);

/** 索引状态 */
router.get(
  "/api/v1/help/admin/index/status",
  requireAuth,
  requirePermission("superAdmin:knowledgeCenter:list"),
  asyncHandler(async (req, res) => {
    res.json(ok(await helpAdminService.getIndexStatus(textField(req, "locale"))));
  })
);

export default router;
