/**
 * ============================================================
 * 服务启动引导（bootstrap.ts）
 * ------------------------------------------------------------
 * 统一管理服务启动与优雅关闭流程：
 *   1. 初始化数据库连接、help.db 结构与运行时配置
 *   2. 启动 HTTP 服务
 *   3. 注册优雅关闭：SIGTERM / SIGINT → 停止接收新连接 →
 *      等待在途请求完成（超时兜底）→ 关闭 Prisma → 退出
 *
 * 以后加新的初始化步骤，直接在 initSteps 数组里加就行
 * ============================================================
 */

import { Application } from "express";
import os from "os";
import appConfig from "@src/config/app.config";
import { prisma } from "@src/db/prisma";
import { runHelpMigrations } from "@src/db/helpMigrations";
import { loadRuntimeConfig } from "@src/config/runtimeConfig";

/** 现场检测本机局域网 IP（bootstrap 兜底：LOCAL_IP 未写入 .env 时也能显示） */
function detectLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

/** 初始化步骤列表（按顺序执行，可扩展） */
const initSteps: { name: string; run: () => Promise<void> }[] = [
  {
    name: "Database",
    run: async () => {
      // 校验数据库连接（DB_TYPE 由 .env 控制，连接串在 db/prisma.ts 注入）
      await prisma.$queryRaw`SELECT 1`;
    },
  },
  {
    name: "HelpDatabase",
    run: async () => {
      // help.db 与主库分离，启动前显式执行结构迁移，避免 import 隐式改库
      runHelpMigrations();
    },
  },
  {
    name: "RuntimeConfig",
    run: async () => {
      // 把 system_configs 的生效值装入内存，业务模块按 key 读取
      await loadRuntimeConfig();
    },
  },
];

/**
 * 执行启动期初始化（数据库连接 + 运行时参数装载）
 *
 * 与端口监听分离，供 Vitest/Supertest 在导入应用后复用。
 */
export async function initializeRuntime(): Promise<void> {
  for (const step of initSteps) {
    console.log(`Init ${step.name}...`);
    await step.run();
  }
}

/**
 * 启动服务
 * @param app Express 实例
 */
export async function bootstrap(app: Application): Promise<void> {
  const PORT = appConfig.port;
  const HOST = appConfig.host;

  console.log("\n🚀 Server is starting...\n");

  // ---------- 1. 依次执行初始化步骤 ----------
  await initializeRuntime();

  // ---------- 2. 启动 HTTP 服务 ----------
  const server = app.listen(PORT, HOST, () => {
    // 展示地址优化：监听 0.0.0.0（允许局域网/容器访问）时，
    // 本地访问显示 localhost，局域网访问显示 LOCAL_IP（npm run init 自动写入）
    const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
    // 优先用 .env 的 LOCAL_IP（npm run init 写入）；未写入时现场检测兜底
    const localIP = process.env.LOCAL_IP || detectLocalIP();
    const lanAddress = localIP && localIP !== "127.0.0.1" ? `http://${localIP}:${PORT}` : null;

    console.log("\n========================================");
    console.log(`✅ Server is running...`);
    console.log(`⚾️ Local: http://${displayHost}:${PORT}`);
    if (lanAddress) console.log(`🌐 WLAN: ${lanAddress}(LAN Devices are Accessible)`);
    if (process.env.NODE_ENV !== "production") {
      console.log(`📖 API Docs: http://${displayHost}:${PORT}/api-docs`);
    }
    console.log(`📦 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🗄️  Database: ${process.env.DB_TYPE || "sqlite"}`);
    console.log("========================================\n");
  });

  // ---------- 3. 注册优雅关闭 ----------
  // 用途：部署平台（PM2 / Docker / k8s）发来终止信号时，
  //       不再接收新请求、等待在途请求处理完、关闭数据库连接，避免脏数据
  const GRACE_TIMEOUT = 10_000; // 等待在途请求的最大秒数（毫秒）

  const shutdown = (signal: string) => {
    console.log(`\n⏹️  Received ${signal}, shutting down gracefully...`);

    // 1. 停止接收新连接
    server.close(() => {
      console.log("✅ HTTP server closed");
    });

    // 2. 等待在途请求完成（超时兜底强杀）
    const timer = setTimeout(async () => {
      console.warn("⏰ Grace period expired, forcing exit...");
      await prisma.$disconnect();
      process.exit(1);
    }, GRACE_TIMEOUT);
    timer.unref(); // 不阻塞事件循环

    // 3. 正常路径：server.close 回调里关闭数据库并退出
    //    （用 close 事件 + 计数保证在所有连接结束后执行）
    let isClosed = false;
    server.on("close", async () => {
      if (isClosed) return;
      isClosed = true;
      clearTimeout(timer);
      await prisma.$disconnect();
      console.log("✅ Database disconnected");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM")); // PM2 / Docker stop
  process.on("SIGINT", () => shutdown("SIGINT")); // Ctrl+C / nodemon 重启
}
