import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const Database = require("better-sqlite3");
const originalCwd = process.cwd();
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "setp-backup-"));

/** 写入真实 SQLite 文件，避免用文本伪装数据库掩盖 WAL checkpoint 问题 */
function writeDb(file: string, value: string): void {
  const conn = new Database(file);
  try {
    conn.exec("CREATE TABLE IF NOT EXISTS marker (value TEXT NOT NULL)");
    conn.prepare("DELETE FROM marker").run();
    conn.prepare("INSERT INTO marker (value) VALUES (?)").run(value);
  } finally {
    conn.close();
  }
}

function readDb(file: string): string {
  const conn = new Database(file, { readonly: true });
  try {
    return (conn.prepare("SELECT value FROM marker LIMIT 1").get() as { value: string }).value;
  } finally {
    conn.close();
  }
}

/** 备份/恢复 bundle：主库 + help.db + help 文档，旧单文件保持兼容。 */
describe("备份与恢复 bundle", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "test";
    process.env.DB_TYPE = "sqlite";
    process.env.DATABASE_URL = "file:./data/app.db";
    process.env.JWT_SECRET = "j".repeat(40);
    process.env.CONFIG_SECRET_KEY = "c".repeat(40);
    process.env.BACKUP_KEEP = "1";
    process.env.HELP_DATA_DIR = "./data/help";

    fs.mkdirSync(path.join(workspace, "data", "help"), { recursive: true });
    writeDb(path.join(workspace, "data", "app.db"), "main-v1");
    writeDb(path.join(workspace, "data", "help.db"), "help-v1");
    fs.writeFileSync(path.join(workspace, "data", "help", "index.md"), "# help");
    process.chdir(workspace);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    try {
      fs.rmSync(workspace, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {
      // Windows 上杀毒/索引可能短暂占用临时文件，清理失败不影响用例结论
    }
  });

  it("备份产出目录 bundle，并清理超出保留份数的旧备份", async () => {
    fs.mkdirSync(path.join(workspace, "backups", "backup_20000101_000000"), { recursive: true });
    fs.mkdirSync(path.join(workspace, "backups", "backup_20000102_000000"), { recursive: true });

    const { runBackup } = await import("@src/utils/dbBackup.ts");
    const result = await runBackup();

    expect(result.type).toBe("sqlite");
    expect(result.bundleDir.startsWith(path.join(workspace, "backups", "backup_"))).toBe(true);
    expect(readDb(result.file)).toBe("main-v1");
    expect(fs.existsSync(path.join(result.bundleDir, "help.db"))).toBe(true);
    expect(fs.existsSync(path.join(result.bundleDir, "help", "index.md"))).toBe(true);
    expect(result.kept).toBe(1);
    expect(fs.existsSync(path.join(workspace, "backups", "backup_20000101_000000"))).toBe(false);
  });

  it("恢复 bundle 时同时恢复主库与帮助中心，并保留覆盖前副本", async () => {
    const { runBackup } = await import("@src/utils/dbBackup.ts");
    const { runRestore } = await import("@src/utils/dbRestore.ts");
    const backup = await runBackup();

    fs.writeFileSync(path.join(workspace, "data", "app.db"), "main-v2");
    fs.writeFileSync(path.join(workspace, "data", "help.db"), "help-v2");

    const restored = runRestore(backup.bundleDir);
    expect(restored.helpRestored).toBe(true);
    expect(readDb(path.join(workspace, "data", "app.db"))).toBe("main-v1");
    expect(readDb(path.join(workspace, "data", "help.db"))).toBe("help-v1");
    expect(restored.safetyCopy && fs.existsSync(restored.safetyCopy)).toBe(true);
  });

  it("旧版单文件只恢复主库；缺失路径与缺失主库文件直接拒绝", async () => {
    const { runRestore } = await import("@src/utils/dbRestore.ts");
    const single = path.join(workspace, "single.db");
    writeDb(single, "main-single");

    const restored = runRestore(single);
    expect(restored.helpRestored).toBe(false);
    expect(readDb(path.join(workspace, "data", "app.db"))).toBe("main-single");

    expect(() => runRestore(path.join(workspace, "missing.db"))).toThrow("备份路径不存在");
    const emptyBundle = path.join(workspace, "empty-bundle");
    fs.mkdirSync(emptyBundle, { recursive: true });
    expect(() => runRestore(emptyBundle)).toThrow("备份目录中缺少主库文件");
  });
});
