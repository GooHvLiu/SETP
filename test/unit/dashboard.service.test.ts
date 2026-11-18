import { describe, expect, it } from "vitest";

import { TREND_DAYS, buildTrendPoints, buildTrendWindows } from "@src/modules/dashboard/dashboard.service";

/** 看板趋势：窗口生成与空日补零的纯函数回归。 */
describe("看板趋势 service 日窗口", () => {
  it("固定返回 7 天，日期升序，最后一条是基准日", () => {
    const windows = buildTrendWindows(new Date(2026, 10, 18));

    expect(windows).toHaveLength(TREND_DAYS);
    expect(windows.map((item) => item.date)).toEqual([
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
    ]);
  });

  it("跨月边界仍按自然日连续排列", () => {
    const windows = buildTrendWindows(new Date(2026, 2, 2));

    expect(windows.map((item) => item.date)).toEqual([
      "2026-02-24",
      "2026-02-25",
      "2026-02-26",
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });

  it("窗口左闭右开，且次日零点连续", () => {
    const windows = buildTrendWindows(new Date(2026, 10, 18));

    for (let index = 0; index < windows.length - 1; index += 1) {
      expect(windows[index].end.getTime()).toBe(windows[index + 1].start.getTime());
    }
    expect(windows[0].start.getHours()).toBe(0);
    expect(windows[0].start.getMinutes()).toBe(0);
    expect(windows[0].start.getSeconds()).toBe(0);
    expect(windows[0].start.getMilliseconds()).toBe(0);
  });

  it("没有记录的天补 count: 0，不跳过日期", () => {
    const windows = buildTrendWindows(new Date(2026, 10, 18));
    const points = buildTrendPoints(windows, [3, 0, 0, 5, 0, 0, 9]);

    expect(points).toHaveLength(TREND_DAYS);
    expect(points.map((item) => item.count)).toEqual([3, 0, 0, 5, 0, 0, 9]);
    expect(points.every((item) => /^2026-11-\d{2}$/.test(item.date))).toBe(true);
  });
});
