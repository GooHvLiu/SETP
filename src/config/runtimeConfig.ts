/**
 * ============================================================
 * 运行时配置（config/runtimeConfig.ts）
 * ------------------------------------------------------------
 * 启动时把 system_configs 中启用（status=1）的参数装入内存，
 * 页面写入成功后同步更新缓存，业务模块直接读缓存。
 *
 * 取值优先级：DB 值 > env 兜底 > 代码默认值。
 * 未启动/未装载时按注册表实时计算，避免模块加载顺序影响读取。
 * ============================================================
 */

import { prisma } from "@src/db/prisma";
import { CONFIG_REGISTRY, getConfigDefinition, resolveConfigValue } from "./config.registry";

/** key -> 生效值 */
const cache = new Map<string, string>();
/** 是否已完成一次装载 */
let loaded = false;

/** 读取字符串配置 */
export function getConfigValue(key: string): string {
  if (cache.has(key)) return cache.get(key) as string;
  const def = getConfigDefinition(key);
  if (!def) return "";
  return resolveConfigValue(def, null).value;
}

/** 读取数字配置（空串/非法值回退默认，不把空串当 0） */
export function getConfigNumber(key: string): number {
  const def = getConfigDefinition(key);
  const raw = getConfigValue(key).trim();
  if (raw === "") {
    const fallback = def ? Number(def.defaultValue) : 0;
    return Number.isFinite(fallback) ? fallback : 0;
  }
  const num = Number(raw);
  if (Number.isFinite(num)) return num;
  const fallback = def ? Number(def.defaultValue) : 0;
  return Number.isFinite(fallback) ? fallback : 0;
}

/** 读取布尔配置 */
export function getConfigBoolean(key: string): boolean {
  const value = getConfigValue(key).toLowerCase();
  return value === "true" || value === "1";
}

/** 写入缓存（页面更新后立即生效） */
export function setRuntimeConfigValue(key: string, value: string): void {
  cache.set(key, value);
}

/** 装载全部启用参数（启动时调用；失败不阻塞启动） */
export async function loadRuntimeConfig(): Promise<void> {
  try {
    const rows = await prisma.systemConfig.findMany({
      where: { status: 1 },
      select: { configKey: true, configValue: true },
    });

    for (const def of CONFIG_REGISTRY) {
      const row = rows.find((item) => item.configKey === def.key);
      const resolved = resolveConfigValue(def, row?.configValue ?? null);
      cache.set(def.key, resolved.value);
    }
    loaded = true;
    console.log(`✅ 运行时参数装载完成: ${CONFIG_REGISTRY.length} 项`);
  } catch (err) {
    // 表未建/迁移未执行时，服务仍按 env 与代码默认值启动，后续可再重载
    console.warn(`⚠️ 运行时参数装载失败，按 env/默认值运行: ${(err as Error)?.message || String(err)}`);
  }
}
