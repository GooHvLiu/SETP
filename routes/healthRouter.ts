/**
 * ============================================================
 * 健康检查路由（routes/healthRouter.ts）
 * ------------------------------------------------------------
 * GET /      服务存活与基础信息（兼容旧探活地址）
 * GET /live  仅进程存活，不访问数据库（liveness）
 * GET /ready 数据库可查询才返回 200（readiness）
 * 无版本前缀（探活地址保持稳定）
 * ============================================================
 */

import { Router, Request, Response } from "express";
import { prisma } from "@src/db/prisma";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  res.success({ state: "Connected Success", time: Date.now() }, "SUCCESS");
});

/** 存活探针：不触库，容器/负载均衡器高频调用 */
router.get("/live", (_req: Request, res: Response) => {
  res.status(200).json({
    code: 200,
    msg: "ALIVE",
    data: { status: "alive", uptimeSec: Math.floor(process.uptime()) },
    timestamp: Date.now(),
  });
});

/** 就绪探针：数据库不可用时返回 503，避免流量打进未初始化实例 */
router.get("/ready", async (_req: Request, res: Response) => {
  const startedAt = Date.now();
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    res.status(200).json({
      code: 200,
      msg: "READY",
      data: { status: "ready", database: "ok", durationMs: Date.now() - startedAt },
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(503).json({
      code: 503,
      msg: "SERVICE_UNAVAILABLE",
      data: {
        status: "not-ready",
        database: "fail",
        reason: (error as Error)?.message || "database unavailable",
        durationMs: Date.now() - startedAt,
      },
      timestamp: Date.now(),
    });
  }
});

export default router;
