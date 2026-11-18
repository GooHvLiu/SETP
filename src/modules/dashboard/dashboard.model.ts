/**
 * ============================================================
 * 看板趋势模型（modules/dashboard/dashboard.model.ts）
 * ------------------------------------------------------------
 * 前端折线图 / 柱状图共用同一份 points：
 *   - date  固定 YYYY-MM-DD
 *   - count 当日操作条数，没有记录的天补 0
 * ============================================================
 */

/** 单日操作趋势点 */
export interface DashboardTrendPoint {
  /** 日期，YYYY-MM-DD */
  date: string;
  /** 当日操作条数 */
  count: number;
}

/** 看板趋势结果 */
export interface DashboardTrend {
  /** 按日期升序，固定 7 条 */
  points: DashboardTrendPoint[];
}
