/**
 * ============================================================
 * 看板趋势业务逻辑（modules/dashboard/dashboard.service.ts）
 * ------------------------------------------------------------
 * 口径：
 *   - 最近 7 个自然日，含当天，按日期升序；
 *   - 只统计 operation_logs.category = "operation"；
 *   - 登录日志（category = "login"）不计；
 *   - 没有记录的天补 count: 0，前端不会断档。
 *
 * 日期边界按服务端本地时区切分，避免 UTC 日期与前端展示差一天。
 * ============================================================
 */

import { prisma } from "@src/db/prisma";
import { LOG_CATEGORY } from "@src/constants/log";
import type { DashboardTrend, DashboardTrendPoint } from "./dashboard.model";

/** 看板趋势窗口：固定 7 个自然日 */
export const TREND_DAYS = 7;

/** 单日查询窗口 */
export interface TrendWindow {
  /** 当天 00:00:00（本地时区） */
  start: Date;
  /** 次日 00:00:00（本地时区），查询时左闭右开 */
  end: Date;
  /** 日期键，YYYY-MM-DD */
  date: string;
}

/** 本地日期格式化为 YYYY-MM-DD，不能用 toISOString（会按 UTC 切日） */
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 生成最近 7 个自然日的查询窗口，升序排列。
 * 抽成纯函数，便于单测覆盖跨月、跨年与夏令时边界。
 */
export function buildTrendWindows(baseDate: Date = new Date()): TrendWindow[] {
  const today = new Date(baseDate);
  today.setHours(0, 0, 0, 0);

  const windows: TrendWindow[] = [];
  for (let offset = TREND_DAYS - 1; offset >= 0; offset -= 1) {
    const start = new Date(today);
    start.setDate(start.getDate() - offset);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    windows.push({ start, end, date: formatDateKey(start) });
  }

  return windows;
}

/** 把窗口与 count 结果组装为响应；缺省值补 0 */
export function buildTrendPoints(windows: TrendWindow[], counts: number[]): DashboardTrendPoint[] {
  return windows.map((window, index) => ({
    date: window.date,
    count: Number(counts[index]) || 0,
  }));
}

class DashboardService {
  /**
   * 近七日操作条数。
   * 7 次 count 并发执行；created_at 有索引，窗口按左闭右开切分。
   */
  async getTrend(): Promise<DashboardTrend> {
    const windows = buildTrendWindows();

    const counts = await Promise.all(
      windows.map((window) =>
        prisma.operationLog.count({
          where: {
            category: LOG_CATEGORY.OPERATION,
            createdAt: { gte: window.start, lt: window.end },
          },
        })
      )
    );

    return { points: buildTrendPoints(windows, counts) };
  }
}

export default new DashboardService();
