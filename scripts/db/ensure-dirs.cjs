/**
 * ============================================================
 * SQLite 数据目录准备（scripts/db/ensure-dirs.cjs）
 * ------------------------------------------------------------
 * 全新克隆的仓库不含运行时 data/ 目录，而 sqlite 不会自动创建
 * 父目录。这里在 migrate deploy 之前补建，保证首次启动可用。
 *
 * 只在 DB_TYPE=sqlite 时执行；MySQL 模式直接跳过。
 * ============================================================
 */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const dotenvExpand = require("dotenv-expand");

const ROOT = path.resolve(__dirname, "../..");
dotenvExpand.expand(dotenv.config({ path: path.join(ROOT, ".env") }));

function main() {
  const dbType = process.env.DB_TYPE === "mysql" ? "mysql" : "sqlite";
  if (dbType !== "sqlite") return;

  const url = String(process.env.DATABASE_URL || "file:./data/app.db");
  if (!url.startsWith("file:")) {
    throw new Error("DB_TYPE=sqlite 时 DATABASE_URL 必须是 file: 开头的 SQLite 连接串");
  }

  const filePath = url.slice("file:".length);
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(ROOT, filePath);
  const dir = path.dirname(absolutePath);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`[db:ensure-dirs] SQLite 数据目录已就绪: ${dir}`);
}

try {
  main();
} catch (err) {
  console.error("[db:ensure-dirs] 数据目录准备失败:", err.message || err);
  process.exit(1);
}
