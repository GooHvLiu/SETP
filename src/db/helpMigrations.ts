/**
 * ============================================================
 * 帮助中心 SQLite 正式迁移（db/helpMigrations.ts）
 * ------------------------------------------------------------
 * help.db 与主库解耦，但结构升级不能依赖模块加载时的隐式建表。
 * 这里用 _help_migrations 记录版本，首次/旧库运行时补齐表与列；
 * 入口：db:deploy、容器 entrypoint、bootstrap、help:index 命令行。
 * ============================================================
 */

import fs from "fs";
import path from "path";

const HELP_DB_FILE = path.resolve(process.cwd(), "data/help.db");
const MIGRATION_VERSION = "20261114000000_help_schema";

const Database = require("better-sqlite3");

/** 建表语句（新库直接创建；旧库由下方补列逻辑兼容） */
const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS "help_doc" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "locale" TEXT NOT NULL DEFAULT 'zh-CN',
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'template',
    "section_title" TEXT NOT NULL DEFAULT '',
    "section_sort" INTEGER NOT NULL DEFAULT 0,
    "chapter_title" TEXT NOT NULL DEFAULT '',
    "chapter_sort" INTEGER NOT NULL DEFAULT 0,
    "article_sort" INTEGER NOT NULL DEFAULT 0,
    "section_key" TEXT NOT NULL DEFAULT '',
    "chapter_key" TEXT NOT NULL DEFAULT '',
    "doc_key" TEXT NOT NULL DEFAULT '',
    "content_hash" TEXT NOT NULL DEFAULT '',
    "file_size" INTEGER NOT NULL DEFAULT 0,
    "file_mtime" INTEGER NOT NULL DEFAULT 0,
    "indexed_at" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "help_doc_locale_path_key" ON "help_doc"("locale", "path");
  CREATE INDEX IF NOT EXISTS "help_doc_locale_sort_idx" ON "help_doc"("locale", "section_sort", "chapter_sort", "article_sort");
  CREATE TABLE IF NOT EXISTS "_help_migrations" (
    "version" TEXT NOT NULL PRIMARY KEY,
    "applied_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

/** 旧库缺列补齐（SQLite ALTER TABLE 不支持 IF NOT EXISTS） */
const COLUMNS_TO_ADD: Array<[string, string]> = [
  ["section_key", "TEXT NOT NULL DEFAULT ''"],
  ["chapter_key", "TEXT NOT NULL DEFAULT ''"],
  ["doc_key", "TEXT NOT NULL DEFAULT ''"],
  ["content_hash", "TEXT NOT NULL DEFAULT ''"],
  ["file_size", "INTEGER NOT NULL DEFAULT 0"],
  ["file_mtime", "INTEGER NOT NULL DEFAULT 0"],
  ["indexed_at", "TEXT"],
];

/** 执行帮助库迁移；幂等，可重复调用。dbFile 仅测试注入，生产使用默认 data/help.db */
export function runHelpMigrations(dbFile: string = HELP_DB_FILE): void {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const conn = new Database(dbFile, { timeout: 5000 });
  try {
    conn.pragma("journal_mode = WAL");
    conn.exec(CREATE_SQL);

    const applied = conn.prepare(`SELECT 1 FROM "_help_migrations" WHERE "version" = ?`).get(MIGRATION_VERSION);
    if (applied) return;

    const existing = new Set((conn.prepare("PRAGMA table_info('help_doc')").all() as Array<{ name: string }>).map((row) => row.name));
    for (const [name, definition] of COLUMNS_TO_ADD) {
      if (!existing.has(name)) conn.exec(`ALTER TABLE "help_doc" ADD COLUMN "${name}" ${definition}`);
    }
    conn.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS "help_doc_locale_dockey_key"
        ON "help_doc"("locale", "doc_key") WHERE "doc_key" <> '';
    `);
    conn.prepare(`INSERT INTO "_help_migrations" ("version") VALUES (?)`).run(MIGRATION_VERSION);
  } finally {
    conn.close();
  }
}

// 命令行入口：tsx src/db/helpMigrations.ts / node dist/src/db/helpMigrations.js
if (require.main === module) {
  try {
    runHelpMigrations();
    console.log("[help:migrate] help.db 结构已就绪");
    process.exit(0);
  } catch (err) {
    console.error("[help:migrate] 帮助库迁移失败:", (err as Error)?.message || err);
    process.exit(1);
  }
}
