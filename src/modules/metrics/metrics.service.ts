/**
 * ============================================================
 * 运行指标业务逻辑（modules/metrics/metrics.service.ts）
 * ------------------------------------------------------------
 * 采集方式：请求结束时由 metrics.middleware 调 recordRequest，
 *   按分钟分桶（保留 24 小时 = 1440 桶），每桶保存请求数、
 *   错误数、耗时总和与最多 200 条耗时样本用于计算 P95。
 * 查询：按 1h / 6h / 24h 汇总，趋势按 1 / 5 / 15 分钟聚合。
 * 说明：计数只存内存，进程重启归零；重置只清计数，不落库。
 * ============================================================
 */

import { getConfigNumber } from "@src/config/runtimeConfig";
import { MetricsOverview, MetricsPoint, MetricsRange, MetricsResetResult, MetricsTotals } from "./metrics.model";

/** 分桶粒度：1 分钟 */
const BUCKET_MS = 60 * 1000;

/** 分钟内桶 */
interface Bucket {
  ts: number;
  requests: number;
  errors: number;
  durationSum: number;
  samples: number[];
}

/** 内存桶数组（按 ts 升序） */
const buckets: Bucket[] = [];

/** 累计已采集请求数（重置时返回影响面） */
let collectedRequests = 0;

/** 保留一位小数 */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 保留四位小数 */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** 对齐到分钟起点 */
function floorBucket(ts: number): number {
  return Math.floor(ts / BUCKET_MS) * BUCKET_MS;
}

/** 样本数组 P95（空样本返回 0） */
function percentile95(samples: number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return round1(sorted[index]);
}

/** 保留小时数（页面可配，最小 1 / 最大 24） */
function retentionBuckets(): number {
  return Math.max(1, Math.min(24, getConfigNumber("metrics_retention_hours"))) * 60;
}

/** 丢弃超过保留时长的桶 */
function prune(now: number): void {
  const earliest = floorBucket(now) - (retentionBuckets() - 1) * BUCKET_MS;
  while (buckets.length > 0 && buckets[0].ts < earliest) {
    buckets.shift();
  }
}

/** 范围对应的毫秒数与趋势聚合粒度 */
const RANGE_CONFIG: Record<MetricsRange, { spanMs: number; groupMs: number }> = {
  "1h": { spanMs: 60 * 60 * 1000, groupMs: BUCKET_MS },
  "6h": { spanMs: 6 * 60 * 60 * 1000, groupMs: 5 * BUCKET_MS },
  "24h": { spanMs: 24 * 60 * 60 * 1000, groupMs: 15 * BUCKET_MS },
};

class MetricsService {
  /** 记录一次请求（中间件在响应结束时调用） */
  recordRequest(statusCode: number, durationMs: number): void {
    const now = Date.now();
    prune(now);

    const ts = floorBucket(now);
    let bucket = buckets[buckets.length - 1];
    if (!bucket || bucket.ts !== ts) {
      bucket = { ts, requests: 0, errors: 0, durationSum: 0, samples: [] };
      buckets.push(bucket);
    }

    bucket.requests += 1;
    if (statusCode >= 500) bucket.errors += 1;
    bucket.durationSum += durationMs;
    if (bucket.samples.length < getConfigNumber("metrics_sample_limit")) {
      bucket.samples.push(durationMs);
    }
    collectedRequests += 1;
  }

  /** 区间汇总 */
  private summarize(target: Bucket[]): MetricsTotals {
    let requests = 0;
    let errors = 0;
    let durationSum = 0;
    const samples: number[] = [];

    for (const bucket of target) {
      requests += bucket.requests;
      errors += bucket.errors;
      durationSum += bucket.durationSum;
      if (samples.length < getConfigNumber("metrics_sample_limit") * 4) {
        samples.push(...bucket.samples);
      }
    }

    return {
      requests,
      errors,
      errorRate: requests > 0 ? round4(errors / requests) : 0,
      avgDurationMs: requests > 0 ? round1(durationSum / requests) : 0,
      p95DurationMs: percentile95(samples),
    };
  }

  /** 趋势序列（按聚合粒度补点，保证前端曲线连续） */
  private buildSeries(target: Bucket[], since: number, until: number, groupMs: number): MetricsPoint[] {
    const grouped = new Map<number, Bucket>();
    for (const bucket of target) {
      const key = Math.floor(bucket.ts / groupMs) * groupMs;
      const item = grouped.get(key) || { ts: key, requests: 0, errors: 0, durationSum: 0, samples: [] };
      item.requests += bucket.requests;
      item.errors += bucket.errors;
      item.durationSum += bucket.durationSum;
      if (item.samples.length < getConfigNumber("metrics_sample_limit") * 4) {
        item.samples.push(...bucket.samples);
      }
      grouped.set(key, item);
    }

    const series: MetricsPoint[] = [];
    const start = Math.floor(since / groupMs) * groupMs;
    for (let ts = start; ts <= until; ts += groupMs) {
      const item = grouped.get(ts);
      series.push({
        ts,
        requests: item?.requests ?? 0,
        errors: item?.errors ?? 0,
        p95DurationMs: item ? percentile95(item.samples) : 0,
      });
    }
    return series;
  }

  /** 指标总览 */
  getOverview(range: MetricsRange = "1h"): MetricsOverview {
    const now = Date.now();
    prune(now);

    const config = RANGE_CONFIG[range] || RANGE_CONFIG["1h"];
    const since = now - config.spanMs;
    const target = buckets.filter((b) => b.ts >= floorBucket(since));

    const usage = process.memoryUsage();
    const currentBucket = buckets[buckets.length - 1];
    const elapsedMs = currentBucket ? Math.max(now - currentBucket.ts, 1000) : BUCKET_MS;
    const qps = currentBucket ? round1((currentBucket.requests / Math.min(elapsedMs, BUCKET_MS)) * 1000) : 0;

    return {
      range,
      since,
      until: now,
      totals: this.summarize(target),
      current: {
        qps,
        uptimeSec: Math.floor(process.uptime()),
        memory: {
          heapUsedMB: round1(usage.heapUsed / 1024 / 1024),
          heapTotalMB: round1(usage.heapTotal / 1024 / 1024),
          rssMB: round1(usage.rss / 1024 / 1024),
          heapUsedRatio: usage.heapTotal > 0 ? round4(usage.heapUsed / usage.heapTotal) : 0,
        },
      },
      series: this.buildSeries(target, since, now, config.groupMs),
    };
  }

  /** 重置计数（保留进程内存指标与运行时长） */
  reset(): MetricsResetResult {
    const cleared = collectedRequests;
    buckets.length = 0;
    collectedRequests = 0;
    return { clearedRequests: cleared, resetAt: Date.now() };
  }
}

export default new MetricsService();
