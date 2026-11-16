/**
 * 数据恢复脚本（scripts/restore.ts）
 * ------------------------------------------------------------
 * 用法：npm run restore -- --file backups/backup_xxxx.db --yes
 * 安全：必须显式 --yes；SQLite 覆盖前自动留 .before-restore 副本。
 */

import path from "path";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

dotenvExpand.expand(dotenv.config({ path: path.resolve(process.cwd(), ".env") }));

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const file = argValue("--file");
  if (!file) {
    throw new Error("缺少 --file <备份文件路径>");
  }
  if (!process.argv.includes("--yes")) {
    throw new Error("恢复会覆盖当前数据库，请追加 --yes 显式确认");
  }

  // 动态引入：保证 .env 在 env.schema 初始化之前加载
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runRestore } = require("../src/utils/dbRestore");
  const result = runRestore(file);
  console.log(`恢复完成: ${result.file}`);
  console.log(`数据库类型: ${result.type}`);
  if (result.safetyCopy) console.log(`覆盖前副本: ${result.safetyCopy}`);
  if (result.helpRestored) console.log(`帮助中心已恢复${result.helpSafetyCopy ? `，覆盖前副本: ${result.helpSafetyCopy}` : ""}`);
}

main().catch((err) => {
  console.error("恢复失败:", err?.message || err);
  process.exitCode = 1;
});
