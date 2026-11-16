/**
 * ============================================================
 * 应用入口文件（app.ts）
 * ------------------------------------------------------------
 * 职责：
 *   1. 注册路径别名并创建 Express 应用
 *   2. 交给 bootstrap 完成数据库/运行时参数初始化与端口监听
 *
 * 注意：Express 实例的组装逻辑在 src/app.ts 的 createApp()，
 *       测试可直接导入该函数配合 Supertest 使用，不会触发监听。
 * ============================================================
 */

import "module-alias/register";

import { createApp } from "@src/app";
import { bootstrap } from "@src/bootstrap";

const app = createApp();

bootstrap(app).catch((err) => {
  console.error("❌ Server Started Fail:", err);
  process.exit(1);
});

export default app;
