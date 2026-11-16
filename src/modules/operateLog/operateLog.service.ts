/**
 * ============================================================
 * 操作日志业务逻辑（modules/operateLog/operateLog.service.ts）
 * ------------------------------------------------------------
 * 业务审计日志：谁在什么时间做了什么操作
 * 由 operateLog 中间件自动写入，也可手动调用
 * ============================================================
 */

import { prisma } from "@src/db/prisma";

class OperateLogService {
  /**
   * 记录操作日志
   */
  async createLog(data: {
    userId?: number | null;
    username: string;
    category?: string;
    module: string;
    action: string;
    result?: string;
    reason?: string;
    target?: string;
    description: string;
    ip?: string;
    userAgent?: string;
    requestId?: string | null;
  }) {
    return prisma.operationLog.create({
      data: {
        userId: data.userId ?? null,
        username: data.username,
        category: data.category || "operation",
        module: data.module,
        action: data.action,
        result: data.result || "success",
        reason: data.reason || "",
        target: data.target || "",
        description: data.description,
        ip: data.ip || "",
        userAgent: data.userAgent || "",
        requestId: data.requestId || null,
      },
    });
  }
}

export default new OperateLogService();
