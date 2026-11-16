/**
 * ============================================================
 * 健康检查数据类型（modules/health/health.model.ts）
 * ------------------------------------------------------------
 * 供运维「健康检查中心」页使用：
 *   - 单项检查结果 HealthCheckItem
 *   - 一次探测的整体报告 HealthReport
 * 状态语义：ok 正常 / warn 可用但需关注 / fail 不可用 / skip 未启用
 * ============================================================
 */

/** 单项检查状态 */
export type HealthCheckStatus = "ok" | "warn" | "fail" | "skip";

/** 整体结论：全部 ok 为 up，存在 warn 为 degraded，存在 fail 为 down */
export type HealthOverallStatus = "up" | "degraded" | "down";

/** 单项检查结果 */
export interface HealthCheckItem {
  /** 检查项标识，如 database / memory / disk */
  key: string;
  /** 展示名称 i18n key（前端按 key 映射，不在接口返回中文） */
  labelKey: string;
  status: HealthCheckStatus;
  /** 本项耗时（ms） */
  durationMs: number;
  /** 结论说明 i18n key */
  messageKey: string;
  /** 结论插值参数，例如 { usedMB: 12.5, totalMB: 20 } */
  params: Record<string, string | number | undefined>;
}

/** 一次探测的整体报告 */
export interface HealthReport {
  status: HealthOverallStatus;
  /** 探测完成时间（ISO 字符串，便于前端直接展示） */
  checkedAt: string;
  /** 整轮探测耗时（ms） */
  durationMs: number;
  items: HealthCheckItem[];
}

/** 探测请求体（不传则跑全部检查项） */
export interface HealthProbeBody {
  /** 指定检查项 key 列表，如 ["database", "memory"] */
  keys?: string[];
}
