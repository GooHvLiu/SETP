/**
 * ============================================================
 * 数据库备份公共实现（utils/dbBackup.ts）
 * ------------------------------------------------------------
 * 供两处复用：
 *   1. 命令行脚本 scripts/backup.ts（npm run backup）
 *   2. 运维任务中心 POST /api/v1/super-admin/ops/tasks/db-backup/run
 *
 * 一次备份产出一个 bundle 目录，包含：
 *   - database.db / database.sql：主库
 *   - help.db：帮助中心独立 SQLite 知识库
 *   - help/：帮助中心 Markdown / PDF / assets
 * 只保留最近 BACKUP_KEEP 份；旧版单文件备份仍兼容清理。
 * ============================================================
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import env from "@src/config/env.schema";
import dbConfig from "@src/config/db.config";

/** 备份目录（按调用时 cwd 计算，便于脚本/测试切换工作目录） */
function backupDir(): string {
  return path.resolve(process.cwd(), "backups");
}

/** 帮助中心独立 SQLite 文件（与 db/helpDb.ts 保持一致） */
function helpDbFile(): string {
  return path.resolve(process.cwd(), "data/help.db");
}

/** 备份结果 */
export interface BackupResult {
  /** 主库备份文件绝对路径（兼容原有调用方） */
  file: string;
  /** 本次备份 bundle 目录 */
  bundleDir: string;
  /** bundle 内全部产物 */
  files: string[];
  /** 备份方式：sqlite 复制文件 / mysql mysqldump */
  type: "sqlite" | "mysql";
  /** 当前保留份数 */
  kept: number;
}

/** 时间戳文件名前缀（backup_YYYYMMDD_HHMMSS） */
function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** 确保备份目录存在 */
function ensureBackupDir(): void {
  const dir = backupDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** SQLite WAL checkpoint：尽量把 WAL 落回主文件后再复制 */
function checkpointSqlite(file: string): void {
  if (!fs.existsSync(file)) return;
  try {
    const sqlite = require("better-sqlite3");
    // 必须可写连接：只读连接无法执行 wal_checkpoint，会静默漏掉 WAL 中的最新数据
    const conn = new sqlite(file, { timeout: 5000 });
    conn.pragma("wal_checkpoint(TRUNCATE)");
    conn.close();
  } catch (error) {
    // 不能静默继续复制主文件：WAL 未落盘会备份出缺数据的库
    throw new Error(`SQLite WAL checkpoint 失败: ${(error as Error)?.message || error}`);
  }
}

/** 清理旧备份：只保留最近 BACKUP_KEEP 份，返回实际保留数量 */
function cleanupOldBackups(): number {
  const entries = fs
    .readdirSync(backupDir())
    .filter((f) => f.startsWith("backup_"))
    .sort(); // 时间戳文件名按字典序即时间序

  const keep = env.BACKUP_KEEP;
  const toDelete = entries.slice(0, Math.max(0, entries.length - keep));
  for (const entry of toDelete) {
    const target = path.join(backupDir(), entry);
    fs.rmSync(target, { recursive: true, force: true });
  }
  return Math.min(entries.length, keep);
}

/** MySQL 备份：mysqldump 导出 SQL（密码走 MYSQL_PWD，避免出现在进程命令行） */
function backupMysql(target: string): void {
  const { mysql } = dbConfig;
  const out = fs.openSync(target, "w");
  const result = spawnSync("mysqldump", ["-h", mysql.host, "-P", String(mysql.port), "-u", mysql.user, mysql.database], {
    stdio: ["ignore", out, "pipe"],
    env: { ...process.env, MYSQL_PWD: mysql.password },
  });
  fs.closeSync(out);
  if (result.error || result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8").trim() : "";
    throw new Error(`mysqldump 备份失败（退出码 ${result.status ?? "unknown"}）${stderr ? `: ${stderr}` : ""}`);
  }
}

/** SQLite 备份：WAL checkpoint 后复制 db 文件 */
function backupSqlite(target: string): void {
  const dbFile = dbConfig.url.replace(/^file:/, "");
  const absPath = path.resolve(process.cwd(), dbFile);

  if (!fs.existsSync(absPath)) {
    throw new Error(`SQLite 数据库文件不存在: ${absPath}`);
  }
  checkpointSqlite(absPath);
  fs.copyFileSync(absPath, target);
}

/** 帮助中心知识库与文档目录单独备份，避免主库恢复后帮助中心丢失 */
function backupHelp(bundleDir: string): string[] {
  const files: string[] = [];

  if (fs.existsSync(helpDbFile())) {
    checkpointSqlite(helpDbFile());
    const target = path.join(bundleDir, "help.db");
    fs.copyFileSync(helpDbFile(), target);
    files.push(target);
  }

  const helpDataDir = path.resolve(process.cwd(), env.HELP_DATA_DIR);
  if (fs.existsSync(helpDataDir)) {
    const target = path.join(bundleDir, "help");
    fs.cpSync(helpDataDir, target, {
      recursive: true,
      filter: (src) => !src.includes(`${path.sep}.tmp`),
    });
    files.push(target);
  }

  return files;
}

/** 执行备份（失败抛 BACKUP_FAILED，由全局错误处理映射） */
export async function runBackup(): Promise<BackupResult> {
  ensureBackupDir();

  const bundleDir = path.join(backupDir(), `backup_${timestamp()}`);
  fs.mkdirSync(bundleDir, { recursive: true });

  let file: string;
  let type: "sqlite" | "mysql";
  try {
    if (dbConfig.type === "mysql") {
      file = path.join(bundleDir, "database.sql");
      backupMysql(file);
      type = "mysql";
    } else {
      file = path.join(bundleDir, "database.db");
      backupSqlite(file);
      type = "sqlite";
    }
  } catch (err) {
    fs.rmSync(bundleDir, { recursive: true, force: true });
    console.error("[backup] 主库备份失败:", (err as Error)?.message || String(err));
    throw new Error("BACKUP_FAILED");
  }

  const files = [file, ...backupHelp(bundleDir)];
  files.push(bundleDir);

  const kept = cleanupOldBackups();
  return { file, bundleDir, files, type, kept };
}

export default { runBackup };
