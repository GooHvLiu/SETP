/**
 * ============================================================
 * 文件上传配置（config/upload.config.ts）
 * ------------------------------------------------------------
 * 从 env.schema 读取：
 *   - UPLOAD_DIR：上传文件存储目录
 *   - allowedTypes：允许的 MIME 类型列表
 * 大小上限统一由运行时参数 upload_max_size_mb 控制（见 upload.middleware）。
 * ============================================================
 */

import env from "./env.schema";

export interface UploadConfig {
  dir: string;
  allowedTypes: string[];
}

const uploadConfig: UploadConfig = {
  dir: env.UPLOAD_DIR,
  allowedTypes: ["image/jpeg", "image/png", "image/gif", "application/pdf"],
};

export default uploadConfig;
