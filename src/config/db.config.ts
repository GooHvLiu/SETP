/**
 * ============================================================
 * 数据库配置（config/db.config.ts）
 * ------------------------------------------------------------
 * 支持两种模式，通过 .env 的 DB_TYPE 切换：
 *   - sqlite ：Prisma + SQLite 文件库（默认，零配置）
 *   - mysql  ：Prisma + MySQL/MariaDB
 *
 * 约定：
 *   1. DATABASE_URL 是当前库的唯一连接串，DB_TYPE 决定用哪套
 *      schema / migrations / adapter
 *   2. DB_TYPE 与 URL 协议必须一致，不一致启动直接失败
 *   3. MySQL URL 用 WHATWG URL 解析，支持密码特殊字符、省略端口
 * ============================================================
 */

import env from "./env.schema";

/** 数据库类型枚举 */
export type DbType = "mysql" | "sqlite";

/** MySQL 连接配置 */
export interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/** 数据库总配置 */
export interface DbConfig {
  /** 当前数据库模式 */
  type: DbType;
  /** 当前库连接串（来自 .env） */
  url: string;
  /** MySQL 连接池上限 */
  poolSize: number;
  /** MySQL 配置（仅 type=mysql 时使用） */
  mysql: MysqlConfig;
}

/** 从连接串解析 MySQL 各字段；错误信息不拼接完整 URL，避免泄露密码 */
export function parseMysqlUrl(rawUrl: string): MysqlConfig {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
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

/** 当前数据库类型（默认 sqlite，开箱即用） */
const dbType = env.DB_TYPE as DbType;
const rawUrl = env.DATABASE_URL.trim();

if (dbType === "sqlite" && !rawUrl.startsWith("file:")) {
  throw new Error("DB_TYPE=sqlite 时 DATABASE_URL 必须是 file: 开头的 SQLite 连接串");
}
if (dbType === "mysql" && !/^(mysql|mariadb):/i.test(rawUrl)) {
  throw new Error("DB_TYPE=mysql 时 DATABASE_URL 必须是 mysql:// 或 mariadb:// 连接串");
}

const dbConfig: DbConfig = {
  type: dbType,
  url: rawUrl,
  poolSize: env.DB_POOL_SIZE,
  mysql: dbType === "mysql" ? parseMysqlUrl(rawUrl) : { host: "", port: 3306, user: "", password: "", database: "" },
};

export default dbConfig;
