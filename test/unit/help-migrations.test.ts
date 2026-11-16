import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { runHelpMigrations } from "@src/db/helpMigrations";

const Database = require("better-sqlite3");
const dirs: string[] = [];

function tempDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "setp-help-migrate-"));
  dirs.push(dir);
  return path.join(dir, "help.db");
}

function readColumns(file: string): string[] {
  const conn = new Database(file);
  try {
    return (conn.prepare("PRAGMA table_info('help_doc')").all() as Array<{ name: string }>).map((row) => row.name);
  } finally {
    conn.close();
  }
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("help.db 正式迁移", () => {
  it("新库建表、记录迁移版本，重复执行保持幂等", () => {
    const file = tempDb();
    runHelpMigrations(file);
    runHelpMigrations(file);

    const columns = readColumns(file);
    expect(columns).toEqual(expect.arrayContaining(["locale", "path", "doc_key", "content_hash", "indexed_at"]));

    const conn = new Database(file);
    try {
      const rows = conn.prepare(`SELECT "version" FROM "_help_migrations"`).all() as Array<{ version: string }>;
      expect(rows).toHaveLength(1);
      expect(rows[0].version).toBe("20261114000000_help_schema");
      expect(conn.prepare(`SELECT COUNT(*) AS n FROM "help_doc"`).get()).toMatchObject({ n: 0 });
    } finally {
      conn.close();
    }
  });

  it("旧库缺少 manifest 列时逐列补齐并登记版本", () => {
    const file = tempDb();
    const conn = new Database(file);
    conn.exec(`
      CREATE TABLE "help_doc" (
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
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    conn.close();

    runHelpMigrations(file);

    const columns = readColumns(file);
    expect(columns).toEqual(expect.arrayContaining(["section_key", "chapter_key", "doc_key", "file_size", "file_mtime"]));
  });
});
