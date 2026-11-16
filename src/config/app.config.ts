/**
 * ============================================================
 * 应用全局配置（config/app.config.ts）
 * ------------------------------------------------------------
 * 所有配置从 env.schema 读取（zod 已校验），不硬编码：
 *   - 端口 / 监听地址
 *   - 分页默认值
 *   - bcrypt 加密强度
 * ============================================================
 */

import env from "./env.schema";

/** 应用配置接口（TS 类型约束） */
export interface AppConfig {
  port: number;
  host: string;
  pagination: {
    defaultPage: number;
    defaultPageSize: number;
    maxPageSize: number;
  };
  bcrypt: {
    saltRounds: number;
  };
}

/** 组装应用配置 */
const appConfig: AppConfig = {
  port: env.APP_PORT,
  host: env.APP_HOST,

  pagination: {
    defaultPage: 1,
    defaultPageSize: 10,
    maxPageSize: 100,
  },

  bcrypt: {
    saltRounds: 10, // 安全与性能的平衡点
  },
};

export default appConfig;
