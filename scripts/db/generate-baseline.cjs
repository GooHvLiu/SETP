/**
 * 生成 SQLite / MySQL 两条完整基线。
 * 只在重置基线时使用；日常增量迁移由 prisma migrate dev 生成。
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const stamp = process.env.BASELINE_STAMP || "20261111000000";
const name = "init";

function runDiff(schemaFile, dbType, databaseUrl) {
  const args = [
    "prisma",
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema",
    schemaFile,
    "--script"
  ];
  const command = ["npx", ...args].join(" ");
  const result = spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command], {
    cwd: root,
    env: { ...process.env, DB_TYPE: dbType, DATABASE_URL: databaseUrl },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(
      `[generate-baseline] ${dbType} 生成失败\nstatus=${result.status}\nerror=${result.error ? result.error.message : "none"}\n${result.stderr || result.stdout}`
    );
  }
  return result.stdout;
}

function writeBaseline(dbType, schemaFile, databaseUrl) {
  const raw = runDiff(schemaFile, dbType, databaseUrl);
  // Prisma CLI 会把 dotenv 的加载提示混进 stdout，先截到第一行 SQL 再落盘。
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) => /^\s*(--|CREATE|ALTER|DROP|PRAGMA|\/\*)/i.test(line));
  if (start < 0) {
    throw new Error(`[generate-baseline] ${dbType} 输出中没有 SQL 起始行，拒绝写入`);
  }
  const sql = `${lines.slice(start).join("\n").trim()}\n`;
  if (!/CREATE TABLE/i.test(sql)) {
    throw new Error(`[generate-baseline] ${dbType} 输出中没有 CREATE TABLE，拒绝写入`);
  }
  const dir = path.join(root, "prisma", "migrations", dbType, `${stamp}_${name}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "migration.sql"), sql, "utf8");
  fs.writeFileSync(
    path.join(root, "prisma", "migrations", dbType, "migration_lock.toml"),
    `provider = "${dbType}"\n`,
    "utf8"
  );
  console.log(`[generate-baseline] ${dbType}: ${path.relative(root, dir)} (${sql.length} chars)`);
}

writeBaseline("sqlite", "prisma/schema.prisma", "file:./data/app.db");
writeBaseline("mysql", "prisma/schema.mysql.prisma", "mysql://template:template@127.0.0.1:3306/template");
