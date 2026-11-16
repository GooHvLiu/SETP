/**
 * ============================================================
 * 历史敏感配置一次性加密（db/sealSensitiveConfig.ts）
 * ------------------------------------------------------------
 * 早期版本允许 SMTP 授权码等敏感项以明文写入 system_configs。
 * 本脚本按配置注册表的 sensitive 标记逐条补加密，可重复执行：
 * 已是 enc:v1: 密文的值直接跳过，不会二次加密。
 * ============================================================
 */

import { prisma } from "@src/db/prisma";
import { CONFIG_REGISTRY } from "@src/config/config.registry";
import env from "@src/config/env.schema";
import { sealSecret } from "@src/utils/secretBox";

const PREFIX = "enc:v1:";

async function sealSensitiveConfigs(): Promise<void> {
  if (!env.CONFIG_SECRET_KEY?.trim()) {
    throw new Error("CONFIG_SECRET_KEY 未配置，无法加密历史敏感配置");
  }

  const sensitiveKeys = CONFIG_REGISTRY.filter((item) => item.sensitive).map((item) => item.key);
  const rows = await prisma.systemConfig.findMany({
    where: { configKey: { in: sensitiveKeys } },
    select: { id: true, configKey: true, configValue: true },
  });

  let updated = 0;
  for (const row of rows) {
    const value = row.configValue?.trim();
    if (!value || value.startsWith(PREFIX)) continue;
    await prisma.systemConfig.update({
      where: { id: row.id },
      data: { configValue: sealSecret(value) },
    });
    updated += 1;
  }

  console.log(`[config:seal] 扫描 ${rows.length} 项敏感配置，加密 ${updated} 项`);
}

sealSensitiveConfigs()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[config:seal] 失败:", err?.message || err);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
