/**
 * ============================================================
 * 帮助中心文件约束（config/help.config.ts）
 * ------------------------------------------------------------
 * 上传大小、临时目录、静态资源目录集中在此，路由/服务/入口共用。
 * 数据根目录读 HELP_DATA_DIR，切换目录不需要改代码。
 * ============================================================
 */

import path from "path";
import { helpDataDir } from "../modules/help/help.manifest";

/** Markdown 正文上限（2MB） */
export const HELP_MAX_MARKDOWN_SIZE = 2 * 1024 * 1024;
/** PDF / 文档内容上限（20MB） */
export const HELP_MAX_CONTENT_SIZE = 20 * 1024 * 1024;
/** 图片资源上限（5MB） */
export const HELP_MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** 上传临时目录 */
export const HELP_TMP_DIR = path.join(helpDataDir(), ".tmp");
/** 图片静态资源目录 */
export const HELP_ASSETS_DIR = path.join(helpDataDir(), "assets");
