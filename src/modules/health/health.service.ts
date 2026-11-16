/**
 * ============================================================
 * 健康检查业务逻辑（modules/health/health.service.ts）
 * ------------------------------------------------------------
 * 六项探测：数据库 / 内存 / 磁盘 / 日志 / 知识库索引 / AI 依赖
 *   - 数据库与磁盘决定服务可用性，异常记 fail
 *   - 内存使用率、日志目录、知识库索引异常记 warn
 *   - AI 依赖（Ollama）不可达只降级帮助中心，记 warn
 * 每项独立捕获异常，单项失败不影响其它检查继续执行
 *
 * 响应只给标识与参数：labelKey / messageKey + params，文案由前端 i18n 渲染。
 * ============================================================
 */

import fs from "fs";
import path from "path";
import { prisma } from "@src/db/prisma";
import helpDb from "@src/db/helpDb";
import { env } from "@src/config/env.schema";
import { getConfigNumber, getConfigValue } from "@src/config/runtimeConfig";
import { getLogRotateState } from "@src/utils/logRotate";
import { HealthCheckItem, HealthCheckStatus, HealthOverallStatus, HealthReport } from "./health.model";

/** 内部检查结果：只携带 i18n key 与插值参数 */
interface CheckResult {
  status: HealthCheckStatus;
  messageKey: string;
  params?: Record<string, string | number | undefined>;
}
/** 内部检查项定义 */
interface CheckDef {
  key: string;
  labelKey: string;
  run: () => Promise<CheckResult>;
}

/** 数值保留两位小数（避免响应里出现长浮点） */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 字节转 MB（保留两位） */
function toMB(bytes: number): number {
  return round2(bytes / 1024 / 1024);
}

class HealthService {
  /** 检查项注册表（顺序即前端展示顺序） */
  private readonly checks: CheckDef[] = [
    {
      key: "database",
      labelKey: "health.database.label",
      run: async () => {
        const startedAt = Date.now();
        await prisma.$queryRawUnsafe("SELECT 1");
        return { status: "ok", messageKey: "health.database.ok", params: { durationMs: Date.now() - startedAt } };
      },
    },
    {
      key: "memory",
      labelKey: "health.memory.label",
      run: async () => {
        const usage = process.memoryUsage();
        const ratio = usage.heapTotal > 0 ? usage.heapUsed / usage.heapTotal : 0;
        const warnRatio = getConfigNumber("health_memory_warn_ratio");
        const failRatio = getConfigNumber("health_memory_fail_ratio");
        const status: HealthCheckStatus = ratio >= failRatio ? "fail" : ratio >= warnRatio ? "warn" : "ok";
        return {
          status,
          messageKey: "health.memory.usage",
          params: {
            usedMB: toMB(usage.heapUsed),
            totalMB: toMB(usage.heapTotal),
            percent: round2(ratio * 100),
            warnPercent: round2(warnRatio * 100),
            failPercent: round2(failRatio * 100),
          },
        };
      },
    },
    {
      key: "disk",
      labelKey: "health.disk.label",
      run: async () => {
        // 工作目录、日志目录、数据目录都必须可写，否则备份与日志会静默失败
        const dirs = [process.cwd(), path.resolve(process.cwd(), "logs"), path.resolve(process.cwd(), "data")];
        for (const dir of dirs) {
          if (!fs.existsSync(dir)) {
            return { status: "fail", messageKey: "health.disk.dirMissing", params: { dir } };
          }
          fs.accessSync(dir, fs.constants.W_OK);
        }
        return { status: "ok", messageKey: "health.disk.ok" };
      },
    },
    {
      key: "logger",
      labelKey: "health.logger.label",
      run: async () => {
        const logDir = path.resolve(process.cwd(), "logs");
        const maxSizeBytes = env.LOG_MAX_SIZE_MB * 1024 * 1024;
        if (!fs.existsSync(logDir)) {
          return { status: "warn", messageKey: "health.logger.dirMissing" };
        }
        fs.accessSync(logDir, fs.constants.W_OK);
        const state = getLogRotateState({
          dir: logDir,
          baseName: "app.log",
          maxSizeBytes,
          maxFiles: env.LOG_MAX_FILES,
        });
        if (state.size === 0) {
          return { status: "warn", messageKey: "health.logger.empty" };
        }
        return {
          status: "ok",
          messageKey: "health.logger.ok",
          params: {
            sizeMB: toMB(state.size),
            limitMB: env.LOG_MAX_SIZE_MB,
            history: state.history,
            maxFiles: state.maxFiles,
          },
        };
      },
    },
    {
      key: "helpIndex",
      labelKey: "health.helpIndex.label",
      run: async () => {
        const row = helpDb.queryOne<{ total: number }>("SELECT COUNT(*) AS total FROM help_doc");
        const total = Number(row?.total ?? 0);
        if (total === 0) {
          return { status: "warn", messageKey: "health.helpIndex.empty" };
        }
        return { status: "ok", messageKey: "health.helpIndex.ok", params: { total } };
      },
    },
    {
      key: "aiDependency",
      labelKey: "health.aiDependency.label",
      run: async () => {
        const baseUrl = getConfigValue("ai_service_url").trim().replace(/\/+$/, "");
        const model = getConfigValue("ai_model_name").trim();
        if (!baseUrl || !model) {
          return { status: "skip", messageKey: "health.aiDependency.notConfigured" };
        }
        const startedAt = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), getConfigNumber("health_ai_probe_timeout_ms"));
        try {
          const res = await fetch(`${baseUrl}/api/version`, { signal: controller.signal });
          if (!res.ok) {
            return { status: "warn", messageKey: "health.aiDependency.httpError", params: { status: res.status } };
          }
          return { status: "ok", messageKey: "health.aiDependency.ok", params: { durationMs: Date.now() - startedAt } };
        } catch {
          return { status: "warn", messageKey: "health.aiDependency.unreachable" };
        } finally {
          clearTimeout(timer);
        }
      },
    },
  ];

  /** 单项执行（统一计时与异常兜底） */
  private async runItem(def: CheckDef): Promise<HealthCheckItem> {
    const startedAt = Date.now();
    try {
      const result = await def.run();
      return {
        key: def.key,
        labelKey: def.labelKey,
        status: result.status,
        durationMs: Date.now() - startedAt,
        messageKey: result.messageKey,
        params: result.params || {},
      };
    } catch (err) {
      return {
        key: def.key,
        labelKey: def.labelKey,
        status: "fail",
        durationMs: Date.now() - startedAt,
        messageKey: "health.check.failed",
        params: { reason: (err as Error)?.message || String(err) },
      };
    }
  }

  /** 汇总整体结论 */
  private overall(items: HealthCheckItem[]): HealthOverallStatus {
    if (items.some((i) => i.status === "fail")) return "down";
    if (items.some((i) => i.status === "warn")) return "degraded";
    return "up";
  }

  /**
   * 执行健康探测
   * @param keys 指定检查项；不传或为空则跑全部
   */
  async run(keys?: string[]): Promise<HealthReport> {
    const picked = Array.isArray(keys) && keys.length > 0 ? this.checks.filter((c) => keys.includes(c.key)) : this.checks;
    if (picked.length === 0) {
      throw new Error("PARAM_INVALID");
    }

    const startedAt = Date.now();
    const items: HealthCheckItem[] = [];
    for (const def of picked) {
      items.push(await this.runItem(def));
    }

    return {
      status: this.overall(items),
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      items,
    };
  }
}

export default new HealthService();
