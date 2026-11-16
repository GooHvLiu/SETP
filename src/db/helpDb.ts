/**
 * ============================================================
 * 帮助中心独立知识库数据层（db/helpDb.ts）
 * ------------------------------------------------------------
 * AI 知识库（help_doc 文档表）固定使用独立 SQLite 文件 data/help.db，
 * 与主库 DB_TYPE（sqlite|mysql）完全解耦：主库切 MySQL 不影响帮助中心。
 * - 驱动：better-sqlite3（四模板依赖均已内置，无需新增依赖）
 * - 同步内核 + 异步外壳，行/列名自动 camelCase（与主库 database.ts 行为一致）
 * - 模块只负责连接与查询；建表/补列由 db/helpMigrations.ts 在部署与启动阶段执行
 * ============================================================
 */
import fs from "fs";
import path from "path";

/** help 知识库固定文件路径（相对进程 cwd，与主库 data/app.db 平级） */
const HELP_DB_FILE = path.resolve(process.cwd(), "data/help.db");

const Database = require("better-sqlite3");

/** 确保 data 目录存在（首次运行自动创建） */
if (!fs.existsSync(path.dirname(HELP_DB_FILE))) {
  fs.mkdirSync(path.dirname(HELP_DB_FILE), { recursive: true });
}

const conn = new Database(HELP_DB_FILE);
conn.pragma("journal_mode = WAL");

// 表结构由 db/helpMigrations.ts 在启动/部署阶段正式迁移，
// 本模块只负责连接与查询，避免 import 时隐式改库。

/** snake_case → camelCase（real_name → realName） */
function toCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** 行级转换：列名 camelCase（与主库 database.ts 行为一致） */
function mapRows(rows: any[]): any[] {
  return rows.map((row) => {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) out[toCamel(key)] = value;
    return out;
  });
}

export interface HelpDbExecResult {
  changes: number;
  lastInsertRowid: number | null;
}

/** 帮助知识库访问接口（同步内核，方法与主库 db 对齐） */
export const helpDb = {
  query<T = any>(sql: string, params: any[] = []): T[] {
    return mapRows(conn.prepare(sql).all(...params)) as T[];
  },
  queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const row = conn.prepare(sql).get(...params);
    return row ? (mapRows([row])[0] as T) : null;
  },
  execute(sql: string, params: any[] = []): HelpDbExecResult {
    const info = conn.prepare(sql).run(...params);
    return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
  },
  /** 清空整表（幂等重建用） */
  clear(): void {
    conn.exec("DELETE FROM help_doc");
  },
  /** 事务：回调内所有语句同生共死（better-sqlite3 同步事务） */
  transaction<T>(fn: () => T): T {
    return conn.transaction(fn)();
  },
};

export default helpDb;
