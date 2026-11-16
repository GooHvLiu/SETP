/**
 * ============================================================
 * 跨域中间件（middleware/cors.middleware.ts）
 * ------------------------------------------------------------
 * 统一配置 CORS：
 *   - 开发环境：允许所有来源
 *   - 生产环境：从 CORS_ORIGINS 环境变量读取白名单域名（逗号分隔）
 * ============================================================
 */

import cors from "cors";
import env from "../config/env.schema";

/** 生产环境白名单来源（逗号分隔，如 https://admin.example.com） */
const ALLOWED_ORIGINS = (env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  // 开发环境放开；生产环境仅允许白名单
  origin:
    env.NODE_ENV === "production"
      ? ALLOWED_ORIGINS.length > 0
        ? ALLOWED_ORIGINS
        : false // 白名单为空则全部拒绝（安全）
      : true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "Accept-Language"],
  exposedHeaders: ["Content-Disposition", "X-Request-ID"],
  credentials: true,
};

export default cors(corsOptions);
