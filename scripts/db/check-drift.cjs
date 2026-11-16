/**
 * 数据库漂移检查（scripts/db/check-drift.cjs）
 * ------------------------------------------------------------
 * 对比「当前 DATABASE_URL 指向的真实库」与「当前 DB_TYPE 对应的 Prisma schema」：
 *   - 无差异：退出 0
 *   - 有差异：打印 Prisma 差异并退出 1
 *   - 检查失败：沿用 Prisma 退出码
 * 用法：npm run db:drift
 */

const path = require("path");
const { spawnSync } = require("child_process");
require("dotenv-expand").expand(require("dotenv").config());

const dbType = process.env.DB_TYPE === "mysql" ? "mysql" : "sqlite";
const schema = dbType === "mysql" ? "prisma/schema.mysql.prisma" : "prisma/schema.prisma";
const prismaCli = path.resolve(__dirname, "..", "..", "node_modules", "prisma", "build", "index.js");

const result = spawnSync(
  process.execPath,
  [prismaCli, "migrate", "diff", "--from-config-datasource", "--to-schema", schema, "--exit-code"],
  { stdio: "inherit" }
);

if (result.status === 2) {
  console.error(`[db:drift] ${dbType} 实际库与 ${schema} 存在差异，请补迁移或修正 schema`);
  process.exit(1);
}
process.exit(result.status ?? 1);
