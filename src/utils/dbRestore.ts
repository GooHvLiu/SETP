/**
 * ============================================================
 * 数据库恢复公共实现（utils/dbRestore.ts）
 * ------------------------------------------------------------
 * 与 runBackup 对称：
 *   - 目录 bundle：恢复主库 + help.db + help/ 文档
 *   - 旧版单文件：只恢复主库，保持兼容
 * SQLite 覆盖前保留 .before-restore 副本；MySQL 用 mysql 客户端回灌。
 * 仅供 scripts/restore.ts 的显式恢复命令使用，不挂 HTTP 接口。
 * ============================================================
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import env from "@src/config/env.schema";
import dbConfig from "@src/config/db.config";

export interface RestoreResult {
  file: string;
  type: "sqlite" | "mysql";
  /** 覆盖前保留的原库副本（首次恢复时为空） */
  safetyCopy?: string;
  /** 是否恢复了帮助中心知识库 */
  helpRestored: boolean;
  /** 帮助中心覆盖前副本 */
  helpSafetyCopy?: string;
}

/** 恢复 SQLite：先备份当前文件，再覆盖 */
function restoreSqlite(file: string): { safetyCopy?: string } {
  const dbFile = dbConfig.url.replace(/^file:/, "");
  const absPath = path.resolve(process.cwd(), dbFile);
  let safetyCopy: string | undefined;
  if (fs.existsSync(absPath)) {
    safetyCopy = `${absPath}.before-restore-${Date.now()}`;
    fs.copyFileSync(absPath, safetyCopy);
  }
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.copyFileSync(file, absPath);
  return { safetyCopy };
}

/** 恢复 MySQL：mysql 客户端读取 SQL 文件，密码走 MYSQL_PWD */
function restoreMysql(file: string): void {
  const { mysql } = dbConfig;
  const input = fs.openSync(file, "r");
  const result = spawnSync("mysql", ["-h", mysql.host, "-P", String(mysql.port), "-u", mysql.user, mysql.database], {
    stdio: [input, "ignore", "pipe"],
    env: { ...process.env, MYSQL_PWD: mysql.password },
  });
  fs.closeSync(input);
  if (result.error || result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8").trim() : "";
    throw new Error(`mysql 恢复失败（退出码 ${result.status ?? "unknown"}）${stderr ? `: ${stderr}` : ""}`);
  }
}

/** 恢复帮助中心独立知识库与文档目录 */
function restoreHelp(bundleDir: string): { helpRestored: boolean; helpSafetyCopy?: string } {
  const helpDbBackup = path.join(bundleDir, "help.db");
  const helpDocsBackup = path.join(bundleDir, "help");
  if (!fs.existsSync(helpDbBackup) && !fs.existsSync(helpDocsBackup)) {
    return { helpRestored: false };
  }

  const stamp = Date.now();
  let helpSafetyCopy: string | undefined;

  if (fs.existsSync(helpDbBackup)) {
    const helpDbFile = path.resolve(process.cwd(), "data/help.db");
    if (fs.existsSync(helpDbFile)) {
      helpSafetyCopy = `${helpDbFile}.before-restore-${stamp}`;
      fs.copyFileSync(helpDbFile, helpSafetyCopy);
    }
    fs.mkdirSync(path.dirname(helpDbFile), { recursive: true });
    fs.copyFileSync(helpDbBackup, helpDbFile);
  }

  if (fs.existsSync(helpDocsBackup)) {
    const helpDataDir = path.resolve(process.cwd(), env.HELP_DATA_DIR);
    if (fs.existsSync(helpDataDir)) {
      const docsSafetyCopy = `${helpDataDir}.before-restore-${stamp}`;
      fs.cpSync(helpDataDir, docsSafetyCopy, { recursive: true });
      helpSafetyCopy = helpSafetyCopy || docsSafetyCopy;
      fs.rmSync(helpDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.dirname(helpDataDir), { recursive: true });
    fs.cpSync(helpDocsBackup, helpDataDir, { recursive: true });
  }

  return { helpRestored: true, helpSafetyCopy };
}

/** 执行恢复；调用方必须先确认目标库，脚本层要求 --yes */
export function runRestore(input: string): RestoreResult {
  const absolute = path.resolve(process.cwd(), input);
  if (!fs.existsSync(absolute)) {
    throw new Error(`备份路径不存在: ${absolute}`);
  }

  const isBundle = fs.statSync(absolute).isDirectory();
  const mainFile = isBundle ? path.join(absolute, dbConfig.type === "mysql" ? "database.sql" : "database.db") : absolute;
  if (!fs.existsSync(mainFile)) {
    throw new Error(`备份目录中缺少主库文件: ${mainFile}`);
  }

  let safetyCopy: string | undefined;
  if (dbConfig.type === "mysql") {
    restoreMysql(mainFile);
  } else {
    ({ safetyCopy } = restoreSqlite(mainFile));
  }

  const help = isBundle ? restoreHelp(absolute) : { helpRestored: false };
  return {
    file: mainFile,
    type: dbConfig.type,
    safetyCopy,
    helpRestored: help.helpRestored,
    helpSafetyCopy: help.helpSafetyCopy,
  };
}

export default { runRestore };
