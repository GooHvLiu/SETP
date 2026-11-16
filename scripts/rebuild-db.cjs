#!/usr/bin/env node
/**
 * ============================================================
 * 一键重建数据库（npm run db:rebuild 的前置步骤）
 * ------------------------------------------------------------
 * SQLite：删除 data/app.db 及 -wal/-shm，后续 migrate deploy 建表。
 * MySQL ：执行 prisma migrate reset --force --skip-seed，清库并重建。
 *
 * 数据库类型由 .env 的 DB_TYPE 决定；缺少 .env 时按 SQLite 本地库生成，
 * 不触碰外部 MySQL。
 * 使用前提：先停止正在运行的服务。
 * ============================================================
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");

/** 缺少 .env 时按零配置 SQLite 生成，避免把示例 MySQL 当成真实库清空 */
function createSqliteEnv() {
  const examplePath = path.join(root, ".env.example");
  if (!fs.existsSync(examplePath)) {
    throw new Error("未找到 .env 与 .env.example，无法初始化数据库配置");
  }

  const content = fs
    .readFileSync(examplePath, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      if (/^DB_TYPE\s*=/.test(line)) return "DB_TYPE=sqlite";
      if (/^DATABASE_URL\s*=/.test(line)) return 'DATABASE_URL="file:./data/app.db"';
      return line;
    })
    .join("\n");

  fs.writeFileSync(envPath, content, "utf8");
  console.log("未找到 .env，已按 SQLite 零配置生成；如需 MySQL，请修改 .env 后重新执行");
}

if (!fs.existsSync(envPath)) {
  createSqliteEnv();
}

require("dotenv").config({ path: envPath });
require("dotenv-expand").expand({ parsed: process.env });

const dbType = process.env.DB_TYPE;
if (dbType !== "mysql" && dbType !== "sqlite") {
  throw new Error('DB_TYPE 必须是 "mysql" 或 "sqlite"，请检查 .env');
}

const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) {
  throw new Error("DATABASE_URL 不能为空，请检查 .env");
}

function runPrismaReset() {
  const result = spawnSync(
    process.env.ComSpec || "cmd.exe",
    ["/d", "/s", "/c", "npx prisma migrate reset --force --skip-seed"],
    {
      cwd: root,
      env: { ...process.env, DB_TYPE: "mysql" },
      encoding: "utf8",
      stdio: "inherit"
    }
  );
  if (result.status !== 0) {
    throw new Error(`prisma migrate reset 失败，退出码 ${result.status}`);
  }
}

function resetSqlite() {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("DB_TYPE=sqlite 时 DATABASE_URL 必须以 file: 开头");
  }
  const relative = databaseUrl.replace(/^file:/, "");
  const dbFile = path.resolve(root, relative);
  const files = [dbFile, `${dbFile}-wal`, `${dbFile}-shm`];
  let removed = 0;
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    try {
      fs.unlinkSync(file);
      removed += 1;
    } catch (err) {
      throw new Error(`删除失败：请先停止服务。文件 ${path.relative(root, file)}，原因：${err.message}`);
    }
  }
  console.log(removed > 0 ? `已删除 SQLite 数据库文件（${removed} 个）` : "未发现 SQLite 数据库文件，跳过删除");
}

console.log(`当前数据库类型：${dbType}`);
if (dbType === "mysql") {
  console.log("MySQL：执行 migrate reset，清空并重建当前库");
  runPrismaReset();
} else {
  resetSqlite();
}
