/**
 * ============================================================
 * 系统配置业务逻辑（modules/config/config.service.ts）
 * ------------------------------------------------------------
 * 双域互斥：
 *   system 域 —— 只允许常规系统设置接口读写
 *   super  域 —— 只允许超级设置接口读写
 * 跨域写入直接拒绝，不再使用任意 key 的 upsert。
 *
 * 取值优先级：DB 值 > env 兜底 > 代码默认值。
 * ============================================================
 */

import { prisma } from "@src/db/prisma";
import {
  ConfigDefinition,
  ConfigScope,
  getConfigDefinition,
  parseConfigValidation,
  resolveConfigValue,
  SENSITIVE_CONFIG_MASK,
  validateConfigValue,
} from "@src/config/config.registry";
import { setRuntimeConfigValue } from "@src/config/runtimeConfig";
import { sealSecret } from "@src/utils/secretBox";
import { ConfigDto } from "./config.model";

/** 数据库行（Prisma 与手写 SQL 共用映射） */
type ConfigRow = {
  id: number;
  configKey: string;
  configValue: string | null;
  description: string | null;
  editable: number;
  configScope: string;
  configGroup: string;
  readScope: string;
  valueType: string;
  defaultValue: string | null;
  validationJson: string | null;
  envKey: string | null;
  restartRequired: number;
  sort: number;
  status: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

/** 老数据/未注册 key 的兜底定义，保证接口不会因元数据缺失而崩溃 */
function fallbackDefinition(row: ConfigRow): ConfigDefinition {
  return {
    key: row.configKey,
    scope: row.configScope === "super" ? "super" : "system",
    group: row.configGroup || "",
    readScope: row.readScope === "super" ? "super" : "all",
    type: ["string", "number", "boolean", "enum", "json"].includes(row.valueType) ? (row.valueType as ConfigDefinition["type"]) : "string",
    defaultValue: row.defaultValue ?? "",
    validation: {},
    envKey: row.envKey || undefined,
    sort: row.sort,
    description: row.description || "",
    sensitive: false,
  };
}

/** 数据库行转接口 DTO */
function toDto(row: ConfigRow): ConfigDto {
  const definition = getConfigDefinition(row.configKey) || fallbackDefinition(row);
  const resolved = resolveConfigValue(definition, row.configValue);
  const validation = parseConfigValidation(definition, row.validationJson);

  return {
    id: row.id,
    configKey: row.configKey,
    configValue: definition.sensitive ? (resolved.value ? SENSITIVE_CONFIG_MASK : "") : resolved.value,
    description: row.description,
    editable: row.editable,
    configScope: definition.scope,
    configGroup: definition.group,
    readScope: definition.readScope,
    valueType: definition.type,
    defaultValue: definition.defaultValue || row.defaultValue || "",
    validation: validation as unknown as Record<string, unknown>,
    sensitive: Boolean(definition.sensitive),
    envKey: definition.envKey || row.envKey || null,
    restartRequired: row.restartRequired,
    sort: definition.sort ?? row.sort,
    status: row.status,
    source: resolved.source,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
  };
}

/** 匿名可读的公开配置白名单：只放站点展示与法务信息，不含运维/邮件/AI 等敏感项 */
const PUBLIC_CONFIG_KEYS = [
  "appVersion",
  "site_name",
  "site_description",
  "copyright",
  "default_locale",
  "register_enabled",
  "seller_name",
  "contact_email",
  "legal_version",
  "legal_update_date",
  "legal_effective_date",
] as const;

class ConfigService {
  /** 匿名只读配置子集（登录页启动时使用，无需 token） */
  async getPublicConfig(): Promise<ConfigDto[]> {
    const keySet = new Set<string>(PUBLIC_CONFIG_KEYS);
    const all = await this.getAllConfig();
    return all.filter((item) => keySet.has(item.configKey));
  }

  /** 常规系统设置可读参数（登录即可读，含 read_scope=all 的站点/法务项） */
  async getAllConfig(): Promise<ConfigDto[]> {
    const rows = await prisma.systemConfig.findMany({
      where: { status: 1 },
      orderBy: [{ sort: "asc" }, { id: "asc" }],
    });
    return rows
      .map((row) => {
        const dto = toDto(row as ConfigRow);
        // 本接口只写 system 域；super 域的公开只读项在这里统一标记为不可改
        if (dto.configScope !== "system") dto.editable = 0;
        return dto;
      })
      .filter((item) => item.readScope === "all" && Boolean(getConfigDefinition(item.configKey)))
      .sort((a, b) => a.sort - b.sort || a.id - b.id);
  }

  /** 超级设置全量参数（仅超级设置接口调用） */
  async getSuperConfig(): Promise<ConfigDto[]> {
    const rows = await prisma.systemConfig.findMany({
      where: { status: 1 },
      orderBy: [{ sort: "asc" }, { id: "asc" }],
    });
    return rows
      .map((row) => {
        const dto = toDto(row as ConfigRow);
        // 超级设置域由超管独占，历史 editable=0 不应把参数继续锁死
        dto.editable = 1;
        return dto;
      })
      .filter((item) => item.configScope === "super" && Boolean(getConfigDefinition(item.configKey)))
      .sort((a, b) => a.sort - b.sort || a.id - b.id);
  }

  /**
   * 更新配置
   * @param key 参数键，必须在 system_configs 中存在
   * @param value 字符串值，按 value_type + validation_json 校验
   * @param scope 当前入口所属域，跨域直接拒绝
   */
  async updateConfig(key: string, value: string, scope: ConfigScope = "system"): Promise<ConfigDto> {
    const row = await prisma.systemConfig.findUnique({ where: { configKey: key } });
    if (!row) throw new Error("CONFIG_NOT_FOUND");
    if (row.status !== 1) throw new Error("CONFIG_NOT_EDITABLE");

    const definition = getConfigDefinition(key);
    if (!definition) throw new Error("CONFIG_NOT_FOUND");
    if (definition.scope !== scope) throw new Error("CONFIG_SCOPE_DENIED");
    // editable 只约束常规系统设置域；超级设置域由超管权限本身控制
    if (scope === "system" && row.editable === 0) throw new Error("CONFIG_NOT_EDITABLE");

    if (definition.sensitive) {
      if (value === SENSITIVE_CONFIG_MASK) return toDto(row as ConfigRow);
      if (!value) throw new Error("CONFIG_VALUE_INVALID");
    }

    validateConfigValue(definition, value, row.validationJson);

    const stored = definition.sensitive ? sealSecret(value) : value;
    const updated = await prisma.systemConfig.update({
      where: { configKey: key },
      data: { configValue: stored },
    });
    setRuntimeConfigValue(key, value);
    return toDto(updated as ConfigRow);
  }
  /**
   * 批量更新配置（超级设置页保存用）
   * 先整体校验，再单事务写入，最后统一刷新运行时缓存。
   * 敏感字段提交掩码表示不修改，提交空串视为非法。
   */
  async updateConfigs(items: Array<{ key: string; value: string }>, scope: ConfigScope = "super"): Promise<void> {
    const updates = new Map<string, string>();
    for (const item of items) updates.set(item.key, item.value);

    const keys = Array.from(updates.keys());
    const rows = await prisma.systemConfig.findMany({ where: { configKey: { in: keys } } });
    const rowMap = new Map(rows.map((row) => [row.configKey, row as ConfigRow]));

    const pending: Array<{ key: string; value: string }> = [];
    for (const [key, value] of updates) {
      const row = rowMap.get(key);
      if (!row) throw new Error("CONFIG_NOT_FOUND");
      if (row.status !== 1) throw new Error("CONFIG_NOT_EDITABLE");

      const definition = getConfigDefinition(key);
      if (!definition) throw new Error("CONFIG_NOT_FOUND");
      if (definition.scope !== scope) throw new Error("CONFIG_SCOPE_DENIED");
      if (scope === "system" && row.editable === 0) throw new Error("CONFIG_NOT_EDITABLE");

      if (definition.sensitive) {
        if (value === SENSITIVE_CONFIG_MASK) continue;
        if (!value) throw new Error("CONFIG_VALUE_INVALID");
      }

      validateConfigValue(definition, value, row.validationJson);
      pending.push({ key, value });
    }

    if (pending.length === 0) return;

    await prisma.$transaction(
      pending.map((item) => {
        const definition = getConfigDefinition(item.key);
        return prisma.systemConfig.update({
          where: { configKey: item.key },
          data: { configValue: definition?.sensitive ? sealSecret(item.value) : item.value },
        });
      })
    );

    for (const item of pending) setRuntimeConfigValue(item.key, item.value);
  }
}

export default new ConfigService();
