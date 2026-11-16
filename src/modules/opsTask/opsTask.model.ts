/**
 * ============================================================
 * 运维任务数据类型（modules/opsTask/opsTask.model.ts）
 * ------------------------------------------------------------
 * 任务清单固定为四类：
 *   session-cleanup 清理过期会话（维护）
 *   help-reindex    知识库索引重建（索引）
 *   db-backup       数据库备份（备份）
 *   db-reseed       种子数据重建（危险，需二次确认）
 * 执行记录只存进程内存，重启后清空（模板默认口径）。
 * ============================================================
 */

/** 任务分组 */
export type OpsTaskGroup = "maintenance" | "index" | "backup" | "danger";

/** 任务执行状态 */
export type OpsTaskStatus = "running" | "success" | "failed";

/** 任务定义 */
export interface OpsTaskDef {
  key: string;
  /** 任务名称 i18n key */
  labelKey: string;
  group: OpsTaskGroup;
  /** 是否危险任务：只能走 reseed 专用接口，且需要二次确认 */
  danger: boolean;
  /** 任务说明 i18n key */
  descriptionKey: string;
}

/** 最近一次执行记录 */
export interface OpsTaskLastRun {
  status: OpsTaskStatus;
  /** 开始时间（ISO 字符串） */
  startedAt: string;
  durationMs: number;
  /** 执行结果 i18n key */
  messageKey: string;
  /** 结果插值参数 */
  params: Record<string, string | number>;
}

/** 任务清单项 */
export interface OpsTaskItem extends OpsTaskDef {
  lastRun: OpsTaskLastRun | null;
}

/** 任务清单结果 */
export interface OpsTaskListResult {
  list: OpsTaskItem[];
}

/** 任务执行结果 */
export interface OpsTaskRunResult {
  key: string;
  status: OpsTaskStatus;
  startedAt: string;
  durationMs: number;
  messageKey: string;
  params: Record<string, string | number>;
}

/** 危险任务执行请求体 */
export interface OpsReseedBody {
  /** 二次确认口令，必须为 RESEED */
  confirm?: string;
}
