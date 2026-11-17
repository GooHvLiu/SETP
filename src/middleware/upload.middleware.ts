/**
 * ============================================================
 * 文件上传中间件（middleware/upload.middleware.ts）
 * ------------------------------------------------------------
 * 基于 Multer 封装，统一配置：上传目录、文件大小、文件类型。
 * 大小上限每次请求读取 upload_max_size_mb，页面修改立即生效，
 * 不再在模块加载时固化。
 *
 * 类型校验分两层：
 *   1. file.mimetype 白名单（客户端声明）
 *   2. 落盘后读取文件头 magic number（实际内容）
 * 任何一层不通过都会删除临时文件并返回 FILE_TYPE_NOT_ALLOWED。
 * ============================================================
 */

import fs from "fs";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import uploadConfig from "../config/upload.config";
import { getConfigNumber } from "../config/runtimeConfig";
import { ensureDir } from "../utils/file";

// 确保上传目录存在
ensureDir(uploadConfig.dir);

/** 存储配置：磁盘存储，文件名用随机 UUID 重命名避免冲突 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadConfig.dir);
  },
  filename: (req, file, cb) => {
    // 保留原文件扩展名，文件名用随机 UUID
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

/** 文件过滤器：只允许配置里声明的类型 */
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (uploadConfig.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("FILE_TYPE_NOT_ALLOWED"));
  }
};

/** 文件头校验：防止伪造 Content-Type 上传可执行内容或伪装图片 */
const MAGIC_NUMBER_MATCHERS: Record<string, (head: Buffer) => boolean> = {
  "image/jpeg": (head) => head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff,
  "image/png": (head) =>
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a,
  "image/gif": (head) => head.length >= 6 && head.subarray(0, 4).toString("ascii") === "GIF8",
  "application/pdf": (head) => head.length >= 5 && head.subarray(0, 5).toString("ascii") === "%PDF-",
};

/** 读取文件头 8 字节 */
function readHead(filePath: string): Buffer {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(8);
    fs.readSync(fd, buffer, 0, 8, 0);
    return buffer;
  } finally {
    fs.closeSync(fd);
  }
}

/** 收集本次请求已落盘的文件 */
function collectFiles(req: any): Express.Multer.File[] {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === "object") {
    return Object.values(req.files as Record<string, Express.Multer.File[]>).flat();
  }
  return [];
}

/** 删除已落盘的临时文件，避免非法文件残留 */
function cleanupFiles(files: Express.Multer.File[]): void {
  for (const file of files) {
    try {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch {
      // 清理失败不覆盖原始错误
    }
  }
}

/** 校验实际文件内容；不匹配直接抛 FILE_TYPE_NOT_ALLOWED（导出供单元测试） */
export function validateFiles(files: Express.Multer.File[]): void {
  for (const file of files) {
    const matcher = MAGIC_NUMBER_MATCHERS[file.mimetype];
    if (!matcher) throw new Error("FILE_TYPE_NOT_ALLOWED");
    if (!file.path || !fs.existsSync(file.path)) throw new Error("FILE_TYPE_NOT_ALLOWED");
    if (!matcher(readHead(file.path))) throw new Error("FILE_TYPE_NOT_ALLOWED");
  }
}

/** 包装 Multer 中间件，在落盘后补做 magic number 校验 */
function guarded(middleware: any) {
  return (req: any, res: any, next: any) => {
    middleware(req, res, (err: any) => {
      const files = collectFiles(req);
      if (err) {
        cleanupFiles(files);
        next(err);
        return;
      }
      try {
        validateFiles(files);
        next();
      } catch (error) {
        cleanupFiles(files);
        next(error);
      }
    });
  };
}

/** 按当前参数创建 Multer 实例（单文件上限单位 MB） */
function createUploader(): multer.Multer {
  const maxSizeMb = Math.max(1, getConfigNumber("upload_max_size_mb"));
  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxSizeMb * 1024 * 1024,
    },
  });
}

/**
 * 对外暴露的 Multer 代理：
 * TSOA 在注册路由时会调用 .fields()，这里返回一个延迟到请求时才创建
 * Multer 实例的中间件，从而让页面修改的大小上限即时生效。
 */
export const upload = {
  single(field: string) {
    return guarded((req: any, res: any, next: any) => createUploader().single(field)(req, res, next));
  },
  fields(fields: multer.Field[]) {
    return guarded((req: any, res: any, next: any) => createUploader().fields(fields)(req, res, next));
  },
  array(field: string, maxCount?: number) {
    return guarded((req: any, res: any, next: any) => createUploader().array(field, maxCount)(req, res, next));
  },
  any() {
    return guarded((req: any, res: any, next: any) => createUploader().any()(req, res, next));
  },
  none() {
    return guarded((req: any, res: any, next: any) => createUploader().none()(req, res, next));
  },
} as unknown as multer.Multer;
