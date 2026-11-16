/**
 * ============================================================
 * 环境变量 Schema 校验（config/env.schema.ts）
 * ------------------------------------------------------------
 * 职责：
 *   1. 用 zod 定义 .env 全部变量的类型与规则
 *   2. 启动时 parse 一次，变量缺失/类型错误立即 fail-fast
 *   3. 导出强类型配置对象，替代"手写 interface + 静默默认值"
 *
 * 用法：import { env } from "@src/config/env.schema";
 *       env.APP_PORT（带类型，不再是 string | undefined）
 *
 * ★ 重要：本文件内必须先加载 .env 再 parse。
 *   原因：本文件被其他模块 import 时立即执行 parse，
 *   若 dotenv 加载放在 app.ts（import 提升后），
 *   .env 尚未注入 process.env 就会报 undefined。
 *   因此 dotenv 加载必须在这里完成（唯一权威入口）。
 * ============================================================
 */

// 加载 .env 环境变量（必须最先执行，本文件是配置的唯一入口）
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
dotenvExpand.expand(dotenv.config());

import { z } from "zod";
import {
  TEMPLATE_ADMIN_USERNAME,
  TEMPLATE_ADMIN_PASSWORD,
  TEMPLATE_SUPER_ADMIN_PASSWORD,
  TEMPLATE_ADMIN_RESET_PASSWORD,
} from "../constants/password";

/** 模板默认口令：生产环境禁止直接使用 */
const TEMPLATE_PASSWORDS = new Set([TEMPLATE_ADMIN_PASSWORD, TEMPLATE_SUPER_ADMIN_PASSWORD, TEMPLATE_ADMIN_RESET_PASSWORD]);

/** 模板占位密钥：生产环境禁止直接使用 */
const TEMPLATE_SECRET_MARKERS = ["change-me-in-production", "ci-only-"];

/** 环境变量 Schema（所有配置的单一权威来源） */
const envSchema = z
  .object({
    // ---- 应用 ----
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_PORT: z.coerce.number().int().positive().default(3000),
    APP_HOST: z.string().default("0.0.0.0"),

    // ---- 数据库（二态） ----
    DB_TYPE: z.enum(["mysql", "sqlite"]).default("sqlite"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL 不能为空"),
    DB_POOL_SIZE: z.coerce.number().int().positive().max(100).default(10),

    // ---- 跨域与反向代理 ----
    // 多个来源用英文逗号分隔；生产环境必须显式配置，空值在启动时直接失败
    CORS_ORIGINS: z.string().default(""),
    // Express trust proxy：false / true / 跳数 / 子网，默认 false
    TRUST_PROXY: z.string().default("false"),

    // ---- 默认账号（模板默认值，正式项目必须替换） ----
    ADMIN_USERNAME: z.string().default(TEMPLATE_ADMIN_USERNAME),
    ADMIN_PASSWORD: z.string().default(TEMPLATE_ADMIN_PASSWORD),
    SUPER_ADMIN_PASSWORD: z.string().default(TEMPLATE_SUPER_ADMIN_PASSWORD),
    ADMIN_RESET_PASSWORD: z.string().default(TEMPLATE_ADMIN_RESET_PASSWORD),

    // ---- JWT ----
    JWT_SECRET: z.string().min(32, "JWT_SECRET 至少 32 位，生产环境务必修改默认值"),
    JWT_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

    // ---- 登录安全 ----
    LOGIN_MAX_FAILURES: z.coerce.number().int().positive().default(5),
    LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),

    // ---- 上传 ----
    UPLOAD_DIR: z.string().default("./uploads"),

    // ---- 限流 ----
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    RATE_LIMIT_WINDOW_MIN: z.coerce.number().int().positive().default(15),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    LOGIN_RATE_LIMIT_WINDOW_MIN: z.coerce.number().int().positive().default(1),

    // ---- 日志 ----
    // 是否打印控制台：true=控制台+文件，false=仅写文件 logs/app.log
    LOG_CONSOLE: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
    // 单文件大小上限（MB），超过即轮转为 app-时间戳.log
    LOG_MAX_SIZE_MB: z.coerce.number().int().positive().default(10),
    // 历史日志保留份数（不含当前 app.log）
    LOG_MAX_FILES: z.coerce.number().int().positive().default(7),

    // ---- 备份 ----
    BACKUP_KEEP: z.coerce.number().int().positive().default(7),

    // ---- 配置中心敏感项加密 ----
    // 生产环境必须提供；用于 system_configs 中 SMTP 授权码等敏感值的 AES-256-GCM 加密
    CONFIG_SECRET_KEY: z.string().min(32).optional(),

    // ---- 帮助中心（AI） ----
    // Ollama 服务地址与模型（服务器已装 qwen2.5:7b；不可达/超时时 AI 对话自动降级为检索摘要）
    OLLAMA_BASE_URL: z.string().default("http://127.0.0.1:11434"),
    OLLAMA_MODEL: z.string().default("qwen2.5:7b"),
    OLLAMA_TIMEOUT: z.coerce.number().int().positive().default(60),
    HELP_DATA_DIR: z.string().default("./data/help"),
  })
  .superRefine((data, ctx) => {
    // 生产环境必须显式替换模板默认值，避免“克隆即上线”时带着公开密钥/口令运行
    if (data.NODE_ENV !== "production") return;

    const fail = (path: string, message: string) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    };

    if (!data.CONFIG_SECRET_KEY || TEMPLATE_SECRET_MARKERS.some((marker) => data.CONFIG_SECRET_KEY!.includes(marker))) {
      fail("CONFIG_SECRET_KEY", "生产环境必须配置独立的 CONFIG_SECRET_KEY，且不能使用模板占位值");
    }
    if (TEMPLATE_SECRET_MARKERS.some((marker) => data.JWT_SECRET.includes(marker))) {
      fail("JWT_SECRET", "生产环境必须替换 JWT_SECRET，不能使用模板占位值");
    }
    if (TEMPLATE_PASSWORDS.has(data.ADMIN_PASSWORD)) {
      fail("ADMIN_PASSWORD", "生产环境必须替换 ADMIN_PASSWORD，不能使用模板默认口令");
    }
    if (TEMPLATE_PASSWORDS.has(data.SUPER_ADMIN_PASSWORD)) {
      fail("SUPER_ADMIN_PASSWORD", "生产环境必须替换 SUPER_ADMIN_PASSWORD，不能使用模板默认口令");
    }
    if (TEMPLATE_PASSWORDS.has(data.ADMIN_RESET_PASSWORD)) {
      fail("ADMIN_RESET_PASSWORD", "生产环境必须替换 ADMIN_RESET_PASSWORD，不能使用模板默认口令");
    }
    if (!data.CORS_ORIGINS.trim()) {
      fail("CORS_ORIGINS", "生产环境必须显式配置 CORS_ORIGINS，不能为空");
    }
    if (data.CORS_ORIGINS.includes("*")) {
      fail("CORS_ORIGINS", "生产环境 CORS_ORIGINS 不能使用通配符 *");
    }
  });

/** 解析并导出强类型环境变量（失败会抛错，服务不启动） */
export const env = envSchema.parse(process.env);

/** 环境变量类型（供其它文件引用） */
export type Env = z.infer<typeof envSchema>;

export default env;
