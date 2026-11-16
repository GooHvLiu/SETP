/**
 * ============================================================
 * 运行指标数据类型（modules/metrics/metrics.model.ts）
 * ------------------------------------------------------------
 * 指标来源：请求采集中间件（metrics.middleware.ts）内存分桶，
 * 进程重启后计数归零，不做持久化（模板默认口径）。
 * ============================================================
 */

/** 查询时间范围 */
export type MetricsRange = "1h" | "6h" | "24h";

/** 区间汇总 */
export interface MetricsTotals {
  requests: number;
  errors: number;
  /** 错误率（0~1，保留 4 位小数） */
  errorRate: number;
  avgDurationMs: number;
  p95DurationMs: number;
}

/** 趋势点（按范围采样聚合，避免点数过多） */
export interface MetricsPoint {
  /** 桶起始时间戳（ms） */
  ts: number;
  requests: number;
  errors: number;
  p95DurationMs: number;
}

/** 内存占用 */
export interface MetricsMemory {
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  /** 堆使用率（0~1） */
  heapUsedRatio: number;
}

/** 实时指标 */
export interface MetricsCurrent {
  /** 近 1 分钟平均每秒请求数 */
  qps: number;
  uptimeSec: number;
  memory: MetricsMemory;
}

/** 指标总览 */
export interface MetricsOverview {
  range: MetricsRange;
  since: number;
  until: number;
  totals: MetricsTotals;
  current: MetricsCurrent;
  series: MetricsPoint[];
}

/** 重置结果 */
export interface MetricsResetResult {
  /** 重置前已采集的请求数，便于前端提示影响面 */
  clearedRequests: number;
  resetAt: number;
}
