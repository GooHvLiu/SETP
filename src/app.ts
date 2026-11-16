/**
 * ============================================================
 * Express 应用组装（src/app.ts）
 * ------------------------------------------------------------
 * 只负责创建并返回 Express 实例，不连接数据库、不监听端口。
 * 入口 app.ts 负责启动；Vitest/Supertest 直接调用 createApp()。
 * ============================================================
 */

import "module-alias/register";

import express, { Application } from "express";
import path from "path";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";

import appConfig from "@src/config/app.config";
import env from "@src/config/env.schema";
import { swaggerInfo } from "@src/config/swagger";
import swaggerSpecs from "./swagger/swagger.json";

import corsMiddleware from "@src/middleware/cors.middleware";
import responseMiddleware from "@src/middleware/response.middleware";
import loggerMiddleware from "@src/middleware/logger.middleware";
import metricsMiddleware from "@src/middleware/metrics.middleware";
import { rateLimitMiddleware, loginRateLimitMiddleware } from "@src/middleware/rateLimit.middleware";
import { operateLogMiddleware } from "@src/middleware/operateLog.middleware";
import { errorHandler, notFoundHandler } from "@src/middleware/error.middleware";
import { HELP_ASSETS_DIR } from "@src/config/help.config";
import { upload as uploadMiddleware } from "@src/middleware/upload.middleware";

import healthRouter from "@routes/healthRouter";
import { RegisterRoutes } from "@src/routes/routes";
import superSettingsBatchRouter from "@src/modules/config/superSettings.batch.route";
import mailRouter from "@src/modules/mail/mail.route";
import authRecoveryRouter from "@src/modules/auth/auth.recovery.route";
import helpAdminRouter from "@src/modules/help/help.admin.route";

/**
 * 创建 Express 应用（纯组装，无副作用）
 *
 * 中间件顺序敏感：
 *   helmet → cors → body parser → 统一响应 → 日志 → 指标 → 静态资源 → 健康检查 → 限流
 * 路由顺序敏感：
 *   健康检查 → 登录/验证码严格限流 → 操作日志 → 手写路由 → TSOA → 404 → 错误处理
 */
export function createApp(): Application {
  const app: Application = express();

  // 反向代理信任策略：false / true / 跳数 / 子网，交给 Express 原生解析
  const trustProxy = env.TRUST_PROXY.trim();
  app.set(
    "trust proxy",
    trustProxy === "true" ? true : trustProxy === "false" ? false : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy
  );

  // ---------- 全局中间件 ----------
  // 生产环境保持 Helmet 默认 CSP；开发环境关闭 CSP，避免 /api-docs 的 Swagger UI 被拦截
  app.use(env.NODE_ENV === "production" ? helmet() : helmet({ contentSecurityPolicy: false }));
  app.use(corsMiddleware);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(responseMiddleware);
  app.use(loggerMiddleware);
  app.use(metricsMiddleware);

  // ---------- 静态资源 ----------
  // /uploads 是公开目录：只允许图片内联，PDF 等非图片强制下载并禁止 MIME 嗅探
  app.use(
    "/uploads",
    express.static(path.join(process.cwd(), "uploads"), {
      setHeaders: (res, filePath) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        if (!/\.(jpe?g|png|gif)$/i.test(filePath)) {
          res.setHeader("Content-Disposition", "attachment");
        }
      },
    })
  );
  app.use("/api/v1/help/assets", express.static(HELP_ASSETS_DIR));

  // ---------- Swagger（仅非生产环境） ----------
  if (process.env.NODE_ENV !== "production") {
    Object.assign(swaggerSpecs.info, swaggerInfo);

    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
    console.log(`📖 API Docs: http://localhost:${appConfig.port}/api-docs`);
  }

  // ---------- 业务路由 ----------
  // 探针不参与限流：编排系统/负载均衡的健康检查不能被计数拖垮
  app.use("/", healthRouter);
  app.use(rateLimitMiddleware);
  app.post("/api/v1/auth/login", loginRateLimitMiddleware);
  app.get("/api/v1/captcha", loginRateLimitMiddleware);
  app.use(operateLogMiddleware);
  app.use("/", superSettingsBatchRouter);
  app.use("/", mailRouter);
  app.use("/", authRecoveryRouter);
  app.use("/", helpAdminRouter);
  RegisterRoutes(app, { multer: uploadMiddleware });

  // ---------- 404 与错误处理 ----------
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
