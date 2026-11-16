/**
 * ============================================================
 * 首次启动补齐种子数据（scripts/db/ensure-seed.cjs）
 * ------------------------------------------------------------
 * 使用场景：全新环境执行 npm start 时，自动判断数据库是否已初始化。
 *   - users 表为空 → 执行 prisma/seed.ts，写入角色、菜单、默认账号与系统参数
 *   - users 表已有数据 → 直接跳过，避免每次启动重写角色绑定与配置
 *
 * 依赖前置：prisma migrate deploy 已执行，表结构存在。
 * ============================================================
 */

const { spawnSync } = require("child_process");
const path = require("path");
const dotenv = require("dotenv");
const dotenvExpand = require("dotenv-expand");
const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

const ROOT = path.resolve(__dirname, "../..");
dotenvExpand.expand(dotenv.config({ path: path.join(ROOT, ".env") }));

/** 解析 MySQL 连接串（与 src/config/db.config.ts 保持同一口径） */
function parseMysqlUrl(url) {
  let parsed;
  try {
    parsed = new URL(String(url || ""));
  } catch {
    throw new Error("DATABASE_URL 不是合法的 MySQL 连接串");
  }
  if (parsed.protocol !== "mysql:" && parsed.protocol !== "mariadb:") {
    throw new Error("DATABASE_URL 协议必须是 mysql:// 或 mariadb://");
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (!parsed.hostname || !database) {
    throw new Error("DATABASE_URL 缺少 host 或 database");
  }
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
  };
}

async function main() {
  const dbType = process.env.DB_TYPE === "mysql" ? "mysql" : "sqlite";
  const url = process.env.DATABASE_URL || "file:./data/app.db";

  const adapter =
    dbType === "mysql"
      ? new PrismaMariaDb(parseMysqlUrl(url))
      : new PrismaBetterSqlite3({ url });

  const prisma = new PrismaClient({ adapter });
  try {
    const users = await prisma.user.count();
    if (users > 0) {
      console.log(`✅ 数据库已初始化（用户 ${users} 条），跳过种子数据`);
      console.log("ℹ️ 菜单/权限码有更新时，请显式执行 npm run db:sync（会补齐模板基础数据，不会删除已有角色授权）");
      return;
    }
    console.log("🌱 检测到空数据库，开始写入种子数据...");
    // 生产构建优先执行 dist/prisma/seed.js；源码开发回退 tsx
    const distSeed = path.join(ROOT, "dist", "prisma", "seed.js");
    const tsxCli = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
    const command = require("fs").existsSync(distSeed)
      ? [process.execPath, [distSeed]]
      : [process.execPath, [tsxCli, "prisma/seed.ts"]];
    const result = spawnSync(command[0], command[1], {
      cwd: ROOT,
      stdio: "inherit",
      shell: false,
    });
    if (result.status !== 0) {
      throw new Error(`种子数据写入失败，退出码 ${result.status}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("❌ 数据库初始化检查失败:", err.message || err);
  process.exit(1);
});
