/**
 * ============================================================
 * 上传模块类型定义（modules/upload/upload.model.ts）
 * ============================================================
 */

/** 上传成功返回 */
export interface UploadResultDto {
  url: string; // 访问路径，如 /uploads/xxx.png
  originalName: string; // 原始文件名
  size: number; // 文件大小（字节）
  mimeType: string; // MIME 类型
}
