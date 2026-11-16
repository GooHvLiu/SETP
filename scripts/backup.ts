/**
 * ============================================================
 * 数据备份脚本（scripts/backup.ts）
 * ------------------------------------------------------------
 * 用法：npm run backup
 * 实现已抽到 utils/dbBackup.ts，与运维任务中心共用同一套逻辑：
 *   - mysql  → mysqldump 导出 SQL 文件
 *   - sqlite → WAL checkpoint 后复制 db 文件
 * 备份文件存 ./backups/，默认保留最近 BACKUP_KEEP 份
 * ============================================================
 */

import path from "path";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

// 先加载 .env，再按需引入依赖环境变量的备份实现
dotenvExpand.expand(dotenv.config({ path: path.resolve(process.cwd(), ".env") }));

async function main(): Promise<void> {
  // 动态引入：保证 env.schema 在 .env 加载完成后才初始化
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runBackup } = require("../src/utils/dbBackup");

  const result = await runBackup();
  console.log(`备份完成: ${result.file}`);
  console.log(`保留最近 ${result.kept} 份备份`);
}

main().catch((err) => {
  console.error("备份失败:", err?.message || err);
  process.exitCode = 1;
});
