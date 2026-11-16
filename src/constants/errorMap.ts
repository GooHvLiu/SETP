/**
 * ============================================================
 * 全局错误标识映射总表（constants/errorMap.ts）
 * ------------------------------------------------------------
 * 汇总所有模块的错误映射，给 error.middleware 使用
 * 加新模块只需要在这里展开一下 XXX_ERROR_MAP 即可
 *
 * 使用：error.middleware 识别 `throw`
 * ============================================================
 */

import { GLOBAL_ERROR_MAP } from "./errorCode";

/** 错误标识 → 数字码 总映射表 */
export const ERROR_MAP: Record<string, number> = {
  // 全局通用错误
  ...GLOBAL_ERROR_MAP,
};
