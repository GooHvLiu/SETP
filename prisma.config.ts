/**
 * ============================================================
 * Prisma 7 配置文件（prisma.config.ts，项目根目录）
 * ------------------------------------------------------------
 * Prisma 7 新架构：CLI 命令（generate / migrate / studio）
 * 从这里读取连接串与 schema / migrations 路径，schema.prisma 不写 url
 *
 * 切库规则：
 *   DB_TYPE=sqlite → prisma/schema.prisma + prisma/migrations/sqlite
 *   DB_TYPE=mysql  → prisma/schema.mysql.prisma + prisma/migrations/mysql
 *
 * 因此客户只需要改 .env 的 DB_TYPE 与 DATABASE_URL，
 * db:generate / db:deploy / db:seed / db:rebuild 会自动走对应库。
 * ============================================================
 */

import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { defineConfig } from "prisma/config";

dotenvExpand.expand(dotenv.config());

const dbType = process.env.DB_TYPE === "mysql" ? "mysql" : "sqlite";
const schema = dbType === "mysql" ? "prisma/schema.mysql.prisma" : "prisma/schema.prisma";
const migrationsPath = `prisma/migrations/${dbType}`;

export default defineConfig({
  schema,
  migrations: {
    path: migrationsPath,
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
