/**
 * ============================================================
 * 共享限流计数存储（middleware/rateLimitStore.ts）
 * ------------------------------------------------------------
 * express-rate-limit 的 Store 实现：计数落主库（SQLite/MySQL），
 * 同一窗口内多实例共享命中次数，避免内存 store 各自计数。
 *
 * 设计取舍：模板不新增 Redis 依赖，用现有 Prisma 连接换取共享；
 * 单次请求多一次数据库读写，限流阈值本身已很低，可接受。
 * 过期记录在 resetKey / resetAll 时清理，避免无限增长。
 * ============================================================
 */

import type { Store, IncrementResponse, Options } from "express-rate-limit";
import env from "../config/env.schema";
import { prisma } from "../db/prisma";

interface RateLimitRow {
  total_hits: number | bigint;
  reset_at: Date | string;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export class PrismaRateLimitStore implements Store {
  /** 计数按 key 全局共享，不使用进程内 localKeys 优化 */
  localKeys = false;

  private windowMs = 0;

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const now = new Date();
    const resetAt = new Date(now.getTime() + this.windowMs);

    try {
      if (env.DB_TYPE === "mysql") {
        await prisma.$executeRawUnsafe(
          `INSERT INTO \`rate_limit_hits\` (\`rate_key\`, \`total_hits\`, \`reset_at\`, \`updated_at\`)
           VALUES (?, 1, ?, ?)
           ON DUPLICATE KEY UPDATE
             \`total_hits\` = IF(\`reset_at\` <= ?, 1, \`total_hits\` + 1),
             \`reset_at\` = IF(\`reset_at\` <= ?, ?, \`reset_at\`),
             \`updated_at\` = ?`,
          key,
          resetAt,
          now,
          now,
          now,
          resetAt,
          now
        );
        const rows = await prisma.$queryRawUnsafe<RateLimitRow[]>(
          `SELECT \`total_hits\`, \`reset_at\` FROM \`rate_limit_hits\` WHERE \`rate_key\` = ?`,
          key
        );
        const row = rows[0];
        if (!row) return { totalHits: 1, resetTime: resetAt };
        return { totalHits: Number(row.total_hits), resetTime: toDate(row.reset_at) };
      }

      const rows = await prisma.$queryRawUnsafe<RateLimitRow[]>(
        `INSERT INTO "rate_limit_hits" ("rate_key", "total_hits", "reset_at", "updated_at")
         VALUES (?, 1, ?, ?)
         ON CONFLICT("rate_key") DO UPDATE SET
           "total_hits" = CASE WHEN "rate_limit_hits"."reset_at" <= ? THEN 1 ELSE "rate_limit_hits"."total_hits" + 1 END,
           "reset_at" = CASE WHEN "rate_limit_hits"."reset_at" <= ? THEN ? ELSE "rate_limit_hits"."reset_at" END,
           "updated_at" = ?
         RETURNING "total_hits", "reset_at"`,
        key,
        resetAt,
        now,
        now,
        now,
        resetAt,
        now
      );
      const row = rows[0];
      if (!row) return { totalHits: 1, resetTime: resetAt };
      return { totalHits: Number(row.total_hits), resetTime: toDate(row.reset_at) };
    } catch (err) {
      // 计数失败不应把全部请求打成 500：放行并记录告警，由反向代理/监控兜底
      console.error("[rate-limit] 共享计数失败，本次放行:", err);
      return { totalHits: 1, resetTime: resetAt };
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      if (env.DB_TYPE === "mysql") {
        await prisma.$executeRawUnsafe(
          `UPDATE \`rate_limit_hits\` SET \`total_hits\` = GREATEST(\`total_hits\` - 1, 0) WHERE \`rate_key\` = ?`,
          key
        );
      } else {
        await prisma.$executeRawUnsafe(`UPDATE "rate_limit_hits" SET "total_hits" = MAX("total_hits" - 1, 0) WHERE "rate_key" = ?`, key);
      }
    } catch (err) {
      console.error("[rate-limit] 递减计数失败:", err);
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      const table = env.DB_TYPE === "mysql" ? "`rate_limit_hits`" : `"rate_limit_hits"`;
      const column = env.DB_TYPE === "mysql" ? "`rate_key`" : `"rate_key"`;
      await prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE ${column} = ?`, key);
    } catch (err) {
      console.error("[rate-limit] 重置计数失败:", err);
    }
  }

  async resetAll(): Promise<void> {
    try {
      const table = env.DB_TYPE === "mysql" ? "`rate_limit_hits`" : `"rate_limit_hits"`;
      await prisma.$executeRawUnsafe(`DELETE FROM ${table}`);
    } catch (err) {
      console.error("[rate-limit] 清空计数失败:", err);
    }
  }
}
