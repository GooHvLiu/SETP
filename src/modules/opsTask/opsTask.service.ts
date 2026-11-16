/**
 * ============================================================
 * 运维任务业务逻辑（modules/opsTask/opsTask.service.ts）
 * ------------------------------------------------------------
 * 任务执行全部在进程内同步等待完成：
 *   - session-cleanup / help-reindex / db-backup 走内部函数
 *   - db-reseed 通过子进程执行 npm run db:seed（危险，需 RESEED 确认）
 * 执行记录只存内存（重启清空），接口返回 status 表示执行结果；
 * 失败仍返回执行记录，但 HTTP 状态按 TASK_EXEC_FAILED 映射为 504。
 * ============================================================
 */

import { spawn } from "child_process";
import path from "path";
import sessionService from "../session/session.service";
import helpService from "../help/help.service";
import { runBackup } from "@src/utils/dbBackup";
import { getConfigNumber } from "@src/config/runtimeConfig";
import { OpsTaskDef, OpsTaskItem, OpsTaskLastRun, OpsTaskListResult, OpsTaskRunResult } from "./opsTask.model";

/** 危险任务二次确认口令 */
const RESEED_CONFIRM = "RESEED";

/** 子进程任务超时（分钟，页面可配） */
function commandTimeoutMs(): number {
  return getConfigNumber("ops_task_timeout_minutes") * 60 * 1000;
}

/** 任务定义（key 与前端菜单/文档保持一致） */
const TASK_DEFS: OpsTaskDef[] = [
  {
    key: "session-cleanup",
    labelKey: "opsTask.sessionCleanup.label",
    group: "maintenance",
    danger: false,
    descriptionKey: "opsTask.sessionCleanup.description",
  },
  {
    key: "help-reindex",
    labelKey: "opsTask.helpReindex.label",
    group: "index",
    danger: false,
    descriptionKey: "opsTask.helpReindex.description",
  },
  {
    key: "db-backup",
    labelKey: "opsTask.dbBackup.label",
    group: "backup",
    danger: false,
    descriptionKey: "opsTask.dbBackup.description",
  },
  {
    key: "db-reseed",
    labelKey: "opsTask.dbReseed.label",
    group: "danger",
    danger: true,
    descriptionKey: "opsTask.dbReseed.description",
  },
];

/** 最近一次执行记录：task key -> 记录 */
const lastRunMap = new Map<string, OpsTaskLastRun>();
/** 正在执行的任务集合（防并发重复执行） */
const runningKeys = new Set<string>();

/** 执行外部命令并等待退出（Windows 需要 shell 解析 npm.cmd） */
function runCommand(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: process.platform === "win32",
      env: process.env,
    });

    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("TASK_TIMEOUT"));
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error("TASK_EXEC_FAILED"));
      }
    });
  });
}

class OpsTaskService {
  /** 任务清单（含最近一次执行记录） */
  list(): OpsTaskListResult {
    const list: OpsTaskItem[] = TASK_DEFS.map((def) => ({
      ...def,
      lastRun: lastRunMap.get(def.key) ?? null,
    }));
    return { list };
  }

  /** 任务是否存在 */
  private findDef(key: string): OpsTaskDef {
    const def = TASK_DEFS.find((item) => item.key === key);
    if (!def) throw new Error("TASK_NOT_FOUND");
    return def;
  }

  /** 非危险任务的实际执行：只返回 i18n key 与参数 */
  private async execute(key: string): Promise<{ messageKey: string; params: Record<string, string | number> }> {
    if (key === "session-cleanup") {
      const result = await sessionService.cleanup(getConfigNumber("session_cleanup_keep_days"));
      return {
        messageKey: "opsTask.sessionCleanup.success",
        params: { deleted: result.deleted, beforeDays: result.beforeDays },
      };
    }
    if (key === "help-reindex") {
      const result = await helpService.reindex();
      return { messageKey: "opsTask.helpReindex.success", params: { count: result.count } };
    }
    if (key === "db-backup") {
      const result = await runBackup();
      return { messageKey: "opsTask.dbBackup.success", params: { file: path.basename(result.file), kept: result.kept } };
    }
    throw new Error("TASK_NOT_FOUND");
  }

  /** 统一记录执行结果 */
  private finish(
    key: string,
    startedAt: Date,
    status: "success" | "failed",
    messageKey: string,
    params: Record<string, string | number> = {}
  ): OpsTaskRunResult {
    const record: OpsTaskLastRun = {
      status,
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      messageKey,
      params,
    };
    lastRunMap.set(key, record);
    return { key, ...record };
  }

  /**
   * 执行非危险任务
   * @param key 任务标识（session-cleanup / help-reindex / db-backup）
   */
  async run(key: string): Promise<OpsTaskRunResult> {
    const def = this.findDef(key);
    if (def.danger) {
      throw new Error("TASK_DANGER_ONLY");
    }
    if (runningKeys.has(key)) {
      throw new Error("TASK_RUNNING");
    }

    const startedAt = new Date();
    runningKeys.add(key);
    try {
      const result = await this.execute(key);
      return this.finish(key, startedAt, "success", result.messageKey, result.params);
    } catch (err) {
      return this.finish(key, startedAt, "failed", "opsTask.failed", {
        reason: (err as Error)?.message || "UNKNOWN_ERROR",
      });
    } finally {
      runningKeys.delete(key);
    }
  }

  /**
   * 执行危险任务：种子重建
   * @param confirm 必须为 RESEED
   */
  async runReseed(confirm?: string): Promise<OpsTaskRunResult> {
    const key = "db-reseed";
    if (confirm !== RESEED_CONFIRM) {
      throw new Error("TASK_CONFIRM_REQUIRED");
    }
    if (runningKeys.has(key)) {
      throw new Error("TASK_RUNNING");
    }

    const startedAt = new Date();
    runningKeys.add(key);
    try {
      await runCommand("npm", ["run", "db:seed"], commandTimeoutMs());
      return this.finish(key, startedAt, "success", "opsTask.dbReseed.success");
    } catch (err) {
      return this.finish(key, startedAt, "failed", "opsTask.failed", {
        reason: (err as Error)?.message || "UNKNOWN_ERROR",
      });
    } finally {
      runningKeys.delete(key);
    }
  }
}

export default new OpsTaskService();
