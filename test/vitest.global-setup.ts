import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { applyTestEnv } from "./vitest.env";

/**
 * Vitest 全局初始化：
 * 1. 固定测试环境变量；
 * 2. SQLite 模式删除旧测试库，保证每次都是干净基线；
 * 3. 执行与生产一致的 db:prepare（生成 Client → 迁移 → 种子）。
 */
export default async function globalSetup(): Promise<void> {
  applyTestEnv();

  const root = process.cwd();
  if (process.env.DB_TYPE === "sqlite") {
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      fs.rmSync(path.join(root, "data", `test.db${suffix}`), { force: true });
    }
  }

  execSync("npm run db:prepare", {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
}
