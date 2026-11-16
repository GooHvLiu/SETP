/**
 * ============================================================
 * Prisma 客户端单例（db/prisma.ts）
 * ------------------------------------------------------------
 * Prisma 7 新架构（Driver Adapters）：
 *   1. 根据 .env 的 DB_TYPE 选择数据库适配器：
 *      - mysql  → PrismaMariaDb（@prisma/adapter-mariadb）
 *      - sqlite → PrismaBetterSqlite3（@prisma/adapter-better-sqlite3）
 *   2. 连接串来自 .env 的 DATABASE_URL（与 prisma.config.ts 同一来源）
 *   3. 导出统一 prisma 实例，业务代码只 import { prisma }
 *
 * 用法：import { prisma } from "@src/db/prisma";
 *       await prisma.user.findFirst();
 *
 * 切库：只改 .env 的 DB_TYPE 与 DATABASE_URL，然后
 *       npm run db:generate → npm run db:deploy → 重启服务
 *       不需要改 schema provider，不需要改本文件
 * ============================================================
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import dbConfig from "../config/db.config";

/** 根据 DB_TYPE 创建带对应 Driver Adapter 的 PrismaClient */
function createPrismaClient(): PrismaClient {
  if (dbConfig.type === "mysql") {
    // MySQL/MariaDB 专用适配器（参数取自 db.config 解析后的连接串）
    const adapter = new PrismaMariaDb({
      host: dbConfig.mysql.host,
      port: dbConfig.mysql.port,
      user: dbConfig.mysql.user,
      password: dbConfig.mysql.password,
      database: dbConfig.mysql.database,
      connectionLimit: dbConfig.poolSize,
    });
    return new PrismaClient({ adapter });
  }

  // SQLite 专用适配器（连接串 file:./data/app.db）
  const adapter = new PrismaBetterSqlite3({ url: dbConfig.url });
  return new PrismaClient({ adapter });
}

/** Prisma 客户端单例 */
export const prisma = createPrismaClient();

/**
 * 统一事务入口：业务层不直接写 $transaction，便于后续替换重试/日志策略。
 * 用法：await withTransaction((tx) => tx.user.update(...));
 */
export function withTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}

export default prisma;
