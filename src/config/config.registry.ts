/**
 * ============================================================
 * 系统参数注册表（config/config.registry.ts）
 * ------------------------------------------------------------
 * 单一权威来源：表结构、种子数据、接口校验、运行时取值都读这里。
 *
 * 双域约定：
 *   system —— 常规系统设置页维护，系统设置页只能读/写该域
 *   super  —— 超级设置页维护，超级设置页只能读/写该域
 * 一个 key 只属于一个域，不做覆盖、不做同 key 双写。
 *
 * 取值优先级：DB 值 > env 兜底 > default_value。
 * 基础设施参数（数据库连接、JWT 密钥、服务监听端口）只留在 env，不进表。
 * 邮件服务是显式例外：SMTP 端口与授权码由超级设置页维护并落表，
 * 授权码接口只返回掩码；配置 CONFIG_SECRET_KEY 后按 AES-256-GCM 加密存储。
 * ============================================================
 */

import env from "./env.schema";
import { openSecret } from "@src/utils/secretBox";

/** 参数归属域 */
export type ConfigScope = "system" | "super";
/** 读权限域：all=登录即可读，super=仅超级设置接口可读 */
export type ConfigReadScope = "all" | "super";
/** 值类型（前端按类型渲染控件） */
export type ConfigValueType = "string" | "number" | "boolean" | "enum" | "json";

/** 参数校验规则（写入 validation_json，接口按此校验） */
export interface ConfigValidation {
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  maxLength?: number;
  options?: string[];
  format?: "email" | "url" | "date";
}

/** 参数定义 */
export interface ConfigDefinition {
  key: string;
  scope: ConfigScope;
  group: string;
  readScope: ConfigReadScope;
  type: ConfigValueType;
  defaultValue: string;
  /** 种子写入的初始值；null 表示落库为空 */
  seedValue?: string | null;
  validation: ConfigValidation;
  envKey?: string;
  /** env 原值到配置值的单位换算（如秒→毫秒、字节→MB） */
  envTransform?: (raw: string) => string;
  restartRequired?: 0 | 1;
  sort?: number;
  description: string;
  /** 敏感参数：接口返回掩码，不加密存储；前端提交掩码表示不修改 */
  sensitive?: boolean;
}

/** 敏感参数掩码（接口返回；前端提交该值表示不修改） */
export const SENSITIVE_CONFIG_MASK = "******";

/** 注册表（定义顺序；接口最终按 sort、id 排序输出） */
export const CONFIG_REGISTRY: ConfigDefinition[] = [
  {
    key: "appVersion",
    scope: "super",
    group: "site",
    readScope: "all",
    type: "string",
    defaultValue: "0.1",
    seedValue: null,
    validation: { maxLength: 50 },
    sort: 9,
    description: "该系统软件版本",
  },
  // ---------- 超级设置：站点信息（readScope=all，前台可读） ----------
  {
    key: "site_name",
    scope: "super",
    group: "site",
    readScope: "all",
    type: "string",
    defaultValue: "V3TM",
    validation: { maxLength: 100 },
    sort: 10,
    description: "站点名称，前台与登录页展示",
  },
  {
    key: "site_description",
    scope: "super",
    group: "site",
    readScope: "all",
    type: "string",
    defaultValue: "SOFTWARE DESC.",
    validation: { maxLength: 500 },
    sort: 11,
    description: "站点描述，用于前台与分享摘要",
  },
  {
    key: "copyright",
    scope: "super",
    group: "site",
    readScope: "all",
    type: "string",
    defaultValue: "© 2026 V3TM",
    validation: { maxLength: 200 },
    sort: 12,
    description: "页脚版权文案",
  },
  {
    key: "default_locale",
    scope: "system",
    group: "general",
    readScope: "all",
    type: "string",
    defaultValue: "zh-cn",
    validation: { maxLength: 20 },
    sort: 20,
    description: "默认语言（小写连字符，与 data/help 目录同名）",
  },
  {
    key: "request_timeout",
    scope: "system",
    group: "general",
    readScope: "all",
    type: "number",
    defaultValue: "10000",
    validation: { min: 1000, max: 120000, integer: true },
    sort: 21,
    description: "前端请求超时（毫秒）",
  },
  {
    key: "register_enabled",
    scope: "system",
    group: "general",
    readScope: "all",
    type: "boolean",
    defaultValue: "false",
    validation: {},
    sort: 22,
    description: "自助注册开关（false 关闭，true 开放；管理员创建账号不受影响）",
  },

  // ---------- 常规系统设置：帮助中心行为 ----------
  {
    key: "help_mode",
    scope: "system",
    group: "help",
    readScope: "all",
    type: "enum",
    defaultValue: "static",
    validation: { options: ["static", "ai"] },
    sort: 30,
    description: "帮助中心模式：静态浏览 / AI 问答",
  },
  {
    key: "help_answer_policy",
    scope: "system",
    group: "help",
    readScope: "all",
    type: "enum",
    defaultValue: "strict",
    validation: { options: ["strict", "lenient"] },
    sort: 31,
    description: "AI 未命中资料时的回答策略",
  },

  // ---------- 超级设置：AI 服务 ----------
  {
    key: "ai_service_url",
    scope: "super",
    group: "ai",
    readScope: "super",
    type: "string",
    defaultValue: "http://127.0.0.1:11434",
    validation: { maxLength: 500, format: "url" },
    envKey: "OLLAMA_BASE_URL",
    sort: 40,
    description: "AI 服务地址（Ollama 兼容接口）",
  },
  {
    key: "ai_model_name",
    scope: "super",
    group: "ai",
    readScope: "super",
    type: "string",
    defaultValue: "qwen2.5:7b",
    validation: { maxLength: 100 },
    envKey: "OLLAMA_MODEL",
    sort: 41,
    description: "AI 模型名称",
  },
  {
    key: "ai_timeout",
    scope: "super",
    group: "ai",
    readScope: "super",
    type: "number",
    defaultValue: "60000",
    validation: { min: 1000, max: 300000, integer: true },
    envKey: "OLLAMA_TIMEOUT",
    envTransform: (raw) => String(Number(raw) * 1000),
    sort: 42,
    description: "AI 请求超时（毫秒）；env 中 OLLAMA_TIMEOUT 以秒为单位",
  },

  // ---------- 超级设置：法务与联系信息 ----------
  {
    key: "seller_name",
    scope: "super",
    group: "legal",
    readScope: "all",
    type: "string",
    defaultValue: "Your Company",
    validation: { maxLength: 200 },
    sort: 50,
    description: "运营主体名称",
  },
  {
    key: "contact_email",
    scope: "super",
    group: "legal",
    readScope: "all",
    type: "string",
    defaultValue: "contact@example.com",
    validation: { maxLength: 200, format: "email" },
    sort: 51,
    description: "对外联系邮箱",
  },
  {
    key: "legal_version",
    scope: "super",
    group: "legal",
    readScope: "all",
    type: "string",
    defaultValue: "V0.1",
    validation: { maxLength: 50 },
    sort: 52,
    description: "法务条款版本号",
  },
  {
    key: "legal_update_date",
    scope: "super",
    group: "legal",
    readScope: "all",
    type: "string",
    defaultValue: "2026-10-20",
    validation: { maxLength: 20, format: "date" },
    sort: 53,
    description: "法务条款更新日期",
  },
  {
    key: "legal_effective_date",
    scope: "super",
    group: "legal",
    readScope: "all",
    type: "string",
    defaultValue: "2026-10-20",
    validation: { maxLength: 20, format: "date" },
    sort: 54,
    description: "法务条款生效日期",
  },

  // ---------- 超级设置：健康检查中心 ----------
  {
    key: "health_memory_warn_ratio",
    scope: "super",
    group: "health",
    readScope: "super",
    type: "number",
    defaultValue: "0.85",
    validation: { min: 0, max: 1, step: 0.01 },
    sort: 60,
    description: "堆内存告警阈值",
  },
  {
    key: "health_memory_fail_ratio",
    scope: "super",
    group: "health",
    readScope: "super",
    type: "number",
    defaultValue: "0.95",
    validation: { min: 0, max: 1, step: 0.01 },
    sort: 61,
    description: "堆内存严重阈值",
  },
  {
    key: "health_ai_probe_timeout_ms",
    scope: "super",
    group: "health",
    readScope: "super",
    type: "number",
    defaultValue: "2000",
    validation: { min: 500, max: 10000, integer: true },
    sort: 62,
    description: "AI 依赖探测超时（毫秒）",
  },

  // ---------- 超级设置：会话中心 ----------
  {
    key: "session_cleanup_keep_days",
    scope: "super",
    group: "session",
    readScope: "super",
    type: "number",
    defaultValue: "7",
    validation: { min: 1, max: 365, integer: true },
    sort: 70,
    description: "过期会话清理保留天数",
  },

  // ---------- 超级设置：运行指标中心 ----------
  {
    key: "metrics_retention_hours",
    scope: "super",
    group: "metrics",
    readScope: "super",
    type: "number",
    defaultValue: "24",
    validation: { min: 1, max: 24, integer: true },
    sort: 80,
    description: "指标内存桶保留时长（小时）",
  },
  {
    key: "metrics_sample_limit",
    scope: "super",
    group: "metrics",
    readScope: "super",
    type: "number",
    defaultValue: "200",
    validation: { min: 50, max: 1000, integer: true },
    sort: 81,
    description: "单桶耗时样本上限",
  },

  // ---------- 超级设置：运维任务中心 ----------
  {
    key: "ops_task_timeout_minutes",
    scope: "super",
    group: "ops",
    readScope: "super",
    type: "number",
    defaultValue: "10",
    validation: { min: 1, max: 60, integer: true },
    sort: 90,
    description: "运维子进程任务超时（分钟）",
  },

  // ---------- 超级设置：知识库检索 ----------
  {
    key: "help_search_top_n",
    scope: "super",
    group: "help",
    readScope: "super",
    type: "number",
    defaultValue: "3",
    validation: { min: 1, max: 10, integer: true },
    sort: 100,
    description: "AI 问答检索命中条数",
  },
  {
    key: "help_search_term_limit",
    scope: "super",
    group: "help",
    readScope: "super",
    type: "number",
    defaultValue: "20",
    validation: { min: 5, max: 50, integer: true },
    sort: 101,
    description: "检索拆词数量上限",
  },

  // ---------- 超级设置：字典中心 ----------
  {
    key: "dict_cache_ttl_minutes",
    scope: "super",
    group: "dict",
    readScope: "super",
    type: "number",
    defaultValue: "5",
    validation: { min: 1, max: 60, integer: true },
    sort: 110,
    description: "字典内存缓存过期时间（分钟）",
  },

  // ---------- 超级设置：上传与登录安全 ----------
  {
    key: "upload_max_size_mb",
    scope: "super",
    group: "upload",
    readScope: "all",
    type: "number",
    defaultValue: "10",
    validation: { min: 1, max: 100, integer: true },
    sort: 120,
    description: "单文件上传大小上限（MB）",
  },
  {
    key: "login_max_failures",
    scope: "super",
    group: "login",
    readScope: "super",
    type: "number",
    defaultValue: "5",
    validation: { min: 1, max: 20, integer: true },
    envKey: "LOGIN_MAX_FAILURES",
    sort: 130,
    description: "登录连续失败锁定阈值",
  },
  {
    key: "login_lock_minutes",
    scope: "super",
    group: "login",
    readScope: "super",
    type: "number",
    defaultValue: "15",
    validation: { min: 1, max: 1440, integer: true },
    envKey: "LOGIN_LOCK_MINUTES",
    sort: 131,
    description: "登录锁定时长（分钟）",
  },
  // ---------- 超级设置：邮件服务（SMTP 发送 + IMAP 回读） ----------
  // 授权码落表是为了满足「前端超级设置页直接配置」，这是密钥进表的唯一例外；
  // 接口返回一律掩码，运行期只从 system_configs / 运行时缓存读取，不读 MAIL_INIT_*。
  {
    key: "mail_enabled",
    scope: "super",
    group: "mail",
    readScope: "super",
    type: "boolean",
    defaultValue: "true",
    seedValue: "true",
    validation: {},
    sort: 140,
    description: "邮件服务总开关；关闭后业务邮件停止发送，测试接口仍可用于排查",
  },
  {
    key: "mail_smtp_host",
    scope: "super",
    group: "mail",
    readScope: "super",
    type: "string",
    defaultValue: "",
    validation: { maxLength: 200 },
    sort: 141,
    description: "SMTP 服务器地址，按邮件服务商填写",
  },
  {
    key: "mail_smtp_port",
    scope: "super",
    group: "mail",
    readScope: "super",
    type: "number",
    defaultValue: "465",
    validation: { min: 1, max: 65535, integer: true },
    sort: 142,
    description: "SMTP 端口（465=SSL，587=STARTTLS）",
  },
  {
    key: "mail_smtp_secure",
    scope: "super",
    group: "mail",
    readScope: "super",
    type: "boolean",
    defaultValue: "true",
    validation: {},
    sort: 143,
    description: "SMTP 是否使用 SSL；465 端口填 true，587 端口填 false",
  },
  {
    key: "mail_smtp_user",
    scope: "super",
    group: "mail",
    readScope: "super",
    type: "string",
    defaultValue: "",
    seedValue: process.env.MAIL_INIT_USER || null,
    validation: { maxLength: 200, format: "email" },
    sort: 144,
    description: "SMTP 登录账号（使用邮箱完整地址）",
  },
  {
    key: "mail_smtp_pass",
    scope: "super",
    group: "mail",
    readScope: "super",
    type: "string",
    defaultValue: "",
    seedValue: process.env.MAIL_INIT_PASS || null,
    validation: { maxLength: 200 },
    sort: 145,
    description: "SMTP 授权码；敏感参数，接口返回掩码",
    sensitive: true,
  },
  {
    key: "mail_from",
    scope: "super",
    group: "mail",
    readScope: "super",
    type: "string",
    defaultValue: "",
    seedValue: process.env.MAIL_INIT_FROM || process.env.MAIL_INIT_USER || null,
    validation: { maxLength: 200, format: "email" },
    sort: 146,
    description: "发件邮箱地址；留空时回退 mail_smtp_user",
  },
  {
    key: "mail_from_name",
    scope: "super",
    group: "mail",
    readScope: "super",
    type: "string",
    defaultValue: "V3TM",
    validation: { maxLength: 100 },
    sort: 147,
    description: "发件人显示名称",
  },
  {
    key: "mail_timeout_ms",
    scope: "super",
    group: "mail",
    readScope: "super",
    type: "number",
    defaultValue: "10000",
    validation: { min: 1000, max: 60000, integer: true },
    sort: 148,
    description: "SMTP 连接与发送超时（毫秒）",
  },
  {
    key: "mail_imap_host",
    scope: "super",
    group: "mail",
    readScope: "super",
    type: "string",
    defaultValue: "",
    validation: { maxLength: 200 },
    sort: 149,
    description: "IMAP 服务器地址，用于测试邮件回读确认",
  },
  {
    key: "mail_imap_port",
    scope: "super",
    group: "mail",
    readScope: "super",
    type: "number",
    defaultValue: "993",
    validation: { min: 1, max: 65535, integer: true },
    sort: 150,
    description: "IMAP 端口（SSL 常用 993）",
  },
  {
    key: "mail_imap_secure",
    scope: "super",
    group: "mail",
    readScope: "super",
    type: "boolean",
    defaultValue: "true",
    validation: {},
    sort: 151,
    description: "IMAP 是否使用 SSL",
  },
  {
    key: "mail_test_readback",
    scope: "super",
    group: "mail",
    readScope: "super",
    type: "boolean",
    defaultValue: "true",
    validation: {},
    sort: 152,
    description: "测试邮件是否经 IMAP 回读确认；true=收到才算通过",
  },
  {
    key: "mail_test_readback_timeout_ms",
    scope: "super",
    group: "mail",
    readScope: "super",
    type: "number",
    defaultValue: "60000",
    validation: { min: 5000, max: 120000, integer: true },
    sort: 153,
    description: "测试邮件 IMAP 回读最长等待时间（毫秒）",
  },
  {
    key: "mail_notify_enabled",
    scope: "super",
    group: "mail",
    readScope: "super",
    type: "boolean",
    defaultValue: "false",
    seedValue: "false",
    validation: {},
    sort: 154,
    description: "站内通知是否同时发邮件；与 mail_enabled 同时为 true 才发信",
  },
  {
    key: "log_retention_days",
    scope: "super",
    group: "log",
    readScope: "super",
    type: "number",
    defaultValue: "90",
    seedValue: "90",
    validation: { min: 1, max: 3650, integer: true },
    sort: 160,
    description: "日志保留天数；仅用于手动清理时的默认值，不会自动删除",
  },
];

/** key -> 定义 */
export const CONFIG_DEFINITION_MAP = new Map(CONFIG_REGISTRY.map((item) => [item.key, item]));

/** 按 key 取定义 */
export function getConfigDefinition(key: string): ConfigDefinition | undefined {
  return CONFIG_DEFINITION_MAP.get(key);
}

/** 读取环境变量原值（未配置返回空） */
function readEnvRaw(key?: string): string | null {
  if (!key) return null;
  const value = (env as unknown as Record<string, unknown>)[key];
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

/** env 兜底值（按定义转换单位） */
export function getEnvFallback(def: ConfigDefinition): string | null {
  const raw = readEnvRaw(def.envKey);
  if (raw === null) return null;
  if (!def.envTransform) return raw;
  try {
    return def.envTransform(raw);
  } catch {
    return raw;
  }
}

/** 解析校验规则（DB 里的 validation_json 覆盖注册表） */
export function parseConfigValidation(def: ConfigDefinition, raw?: string | null): ConfigValidation {
  if (!raw) return def.validation;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return { ...def.validation, ...parsed } as ConfigValidation;
    }
  } catch {
    // 脏数据不阻塞启动，回退注册表规则
  }
  return def.validation;
}

/**
 * 计算最终生效值
 * 优先级：DB 值 > env 兜底 > 代码默认值
 */
export function resolveConfigValue(
  def: ConfigDefinition,
  dbValue: string | null | undefined
): { value: string; source: "db" | "env" | "default" } {
  if (dbValue !== null && dbValue !== undefined) {
    try {
      return { value: openSecret(dbValue), source: "db" };
    } catch (err) {
      // 密钥轮换或密文损坏时，单条参数回退到 env / 默认值，不拖垮整个配置中心
      console.warn(`[config] ${def.key} 解密失败，按 env/默认值回退: ${(err as Error)?.message || String(err)}`);
    }
  }
  const envValue = getEnvFallback(def);
  if (envValue !== null) {
    return { value: envValue, source: "env" };
  }
  return { value: def.defaultValue, source: "default" };
}

/** 写入前校验：类型 + 范围 + 格式，失败抛 CONFIG_VALUE_INVALID */
export function validateConfigValue(def: ConfigDefinition, value: string, rawValidation?: string | null): void {
  const validation = parseConfigValidation(def, rawValidation);
  const text = String(value ?? "");

  if (def.type === "number") {
    const num = Number(text);
    if (!Number.isFinite(num)) throw new Error("CONFIG_VALUE_INVALID");
    if (validation.integer && !Number.isInteger(num)) throw new Error("CONFIG_VALUE_INVALID");
    if (validation.min !== undefined && num < validation.min) throw new Error("CONFIG_VALUE_INVALID");
    if (validation.max !== undefined && num > validation.max) throw new Error("CONFIG_VALUE_INVALID");
    return;
  }

  if (def.type === "boolean") {
    if (!["true", "false", "1", "0"].includes(text)) throw new Error("CONFIG_VALUE_INVALID");
    return;
  }

  if (def.type === "enum") {
    if (!validation.options || !validation.options.includes(text)) throw new Error("CONFIG_VALUE_INVALID");
    return;
  }

  if (def.type === "json") {
    try {
      JSON.parse(text);
    } catch {
      throw new Error("CONFIG_VALUE_INVALID");
    }
    return;
  }

  if (validation.maxLength !== undefined && text.length > validation.maxLength) {
    throw new Error("CONFIG_VALUE_INVALID");
  }
  if (validation.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    throw new Error("CONFIG_VALUE_INVALID");
  }
  if (validation.format === "url" && !/^https?:\/\/[^\s]+$/i.test(text)) {
    throw new Error("CONFIG_VALUE_INVALID");
  }
  if (validation.format === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error("CONFIG_VALUE_INVALID");
  }
}

/** 按域筛选定义 */
export function listDefinitions(scope?: ConfigScope): ConfigDefinition[] {
  return scope ? CONFIG_REGISTRY.filter((item) => item.scope === scope) : CONFIG_REGISTRY;
}
