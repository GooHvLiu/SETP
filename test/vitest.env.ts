/**
 * 测试环境变量统一入口。
 *
 * 本地默认使用独立的 SQLite 测试库，不污染 data/app.db；
 * CI 通过 DB_TYPE / DATABASE_URL 显式指定矩阵数据库，本文件不覆盖。
 */
export function applyTestEnv(): void {
  process.env.NODE_ENV = "test";
  process.env.APP_PORT = process.env.APP_PORT || "3108";
  process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || "10000";
  process.env.LOGIN_RATE_LIMIT_MAX = process.env.LOGIN_RATE_LIMIT_MAX || "100";
  process.env.LOGIN_RATE_LIMIT_WINDOW_MIN = process.env.LOGIN_RATE_LIMIT_WINDOW_MIN || "1";
  process.env.LOG_CONSOLE = process.env.LOG_CONSOLE || "false";
  process.env.CONFIG_SECRET_KEY = process.env.CONFIG_SECRET_KEY || "test-only-config-secret-0123456789abcdef";

  const hasCiDatabase = Boolean(process.env.CI && process.env.DATABASE_URL);
  if (!hasCiDatabase) {
    process.env.DB_TYPE = "sqlite";
    process.env.DATABASE_URL = "file:./data/test.db";
  }
}
