/**
 * ============================================================
 * 文件工具（utils/file.ts）
 * ------------------------------------------------------------
 * 常用文件操作封装：确保目录存在、安全删除文件等
 * ============================================================
 */

import fs from "fs";
import path from "path";

/** 确保目录存在（不存在则递归创建） */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** 安全删除文件（不存在不报错） */
export function safeUnlink(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/** 拼接并规范化路径 */
export function resolvePath(...segments: string[]): string {
  return path.resolve(...segments);
}
