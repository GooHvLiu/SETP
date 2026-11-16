/**
 * ============================================================
 * 会话中心业务逻辑（modules/session/session.service.ts）
 * ------------------------------------------------------------
 * 数据源 refresh_tokens：一条刷新令牌对应一次登录会话。
 *   - 踢下线：吊销该条刷新令牌（该设备无法再续期）
 *   - force 模式：同时把 users.token_version + 1，
 *     使该用户全部已签发的 access token 立即失效（全端下线）
 *   - 清理：物理删除「已过期或已吊销且超过保留天数」的记录
 * ============================================================
 */

import { prisma } from "@src/db/prisma";
import { getConfigNumber } from "@src/config/runtimeConfig";
import notificationService from "../notification/notification.service";
import logger from "@src/utils/logger";
import {
  SessionBatchRevokeResult,
  SessionCleanupResult,
  SessionItem,
  SessionListResult,
  SessionRevokeResult,
  SessionStatus,
} from "./session.model";

/** 会话列表查询参数 */
interface SessionListParams {
  page?: number;
  pageSize?: number;
  status?: SessionStatus;
  keyword?: string;
}

/** 由库内字段推导会话状态（不落库，避免状态与时间不一致） */
function statusOf(revoked: boolean, expiresAt: Date, now: Date): SessionStatus {
  if (revoked) return "revoked";
  return expiresAt.getTime() <= now.getTime() ? "expired" : "active";
}

class SessionService {
  /** 状态过滤条件（active / expired / revoked 三类互斥） */
  private statusWhere(status: SessionStatus | undefined, now: Date) {
    if (status === "active") return { revoked: false, expiresAt: { gt: now } };
    if (status === "expired") return { revoked: false, expiresAt: { lte: now } };
    if (status === "revoked") return { revoked: true };
    return {};
  }

  /**
   * 会话列表（分页 + 状态过滤 + 用户名模糊）
   * 概览统计始终按全量计算，不随筛选条件变化
   */
  async list(params: SessionListParams): Promise<SessionListResult> {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(Math.max(1, Number(params.pageSize) || 10), 100);
    const now = new Date();

    const where: any = { ...this.statusWhere(params.status, now) };
    if (params.keyword) {
      where.user = { username: { contains: params.keyword } };
    }

    const [total, rows, totalAll, activeCount, expiredCount, revokedCount, userGroups] = await Promise.all([
      prisma.refreshToken.count({ where }),
      prisma.refreshToken.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { username: true } } },
      }),
      prisma.refreshToken.count(),
      prisma.refreshToken.count({ where: this.statusWhere("active", now) }),
      prisma.refreshToken.count({ where: this.statusWhere("expired", now) }),
      prisma.refreshToken.count({ where: this.statusWhere("revoked", now) }),
      prisma.refreshToken.groupBy({ by: ["userId"], _count: { _all: true } }),
    ]);

    const list: SessionItem[] = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      username: row.user?.username ?? "",
      status: statusOf(row.revoked, row.expiresAt, now),
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      summary: {
        total: totalAll,
        active: activeCount,
        expired: expiredCount,
        revoked: revokedCount,
        users: userGroups.length,
      },
      list,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 踢下线单条会话
   * @param id 刷新令牌 id
   * @param force true 时同时提升令牌版本号，该用户全部设备立即失效
   */
  async revoke(id: number, force = false): Promise<SessionRevokeResult> {
    const row = await prisma.refreshToken.findUnique({ where: { id } });
    if (!row) {
      throw new Error("SESSION_NOT_FOUND");
    }
    if (row.revoked) {
      throw new Error("SESSION_ALREADY_REVOKED");
    }

    await prisma.refreshToken.update({ where: { id }, data: { revoked: true } });

    let tokenVersion: number | undefined;
    if (force) {
      const user = await prisma.user.update({
        where: { id: row.userId },
        data: { tokenVersion: { increment: 1 } },
        select: { tokenVersion: true },
      });
      tokenVersion = user.tokenVersion;

      void notificationService
        .notify({
          userIds: [row.userId],
          category: "security",
          type: "warning",
          title: "",
          content: "",
          titleKey: "notification.session.revoked.title",
          contentKey: "notification.session.revoked.content",
          source: "session",
          templateKey: "session_revoked",
          sendEmail: false,
        })
        .catch((error) => logger.warn({ userId: row.userId, error: (error as Error)?.message }, "Session revoke notification failed"));
    }

    return { id, revoked: true, force, tokenVersion };
  }

  /**
   * 批量踢下线
   * @param ids 刷新令牌 id 列表
   * @param force true 时对涉及用户逐个提升令牌版本号
   */
  async revokeBatch(ids: number[], force = false): Promise<SessionBatchRevokeResult> {
    const uniqueIds = Array.from(new Set((ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0)));
    if (uniqueIds.length === 0) {
      throw new Error("PARAM_INVALID");
    }

    const rows = await prisma.refreshToken.findMany({
      where: { id: { in: uniqueIds }, revoked: false },
      select: { id: true, userId: true },
    });

    const result = await prisma.refreshToken.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { revoked: true },
    });

    if (force) {
      const userIds = Array.from(new Set(rows.map((r) => r.userId)));
      for (const userId of userIds) {
        await prisma.user.update({
          where: { id: userId },
          data: { tokenVersion: { increment: 1 } },
        });
      }

      if (userIds.length > 0) {
        void notificationService
          .notify({
            userIds,
            category: "security",
            type: "warning",
            title: "",
            content: "",
            titleKey: "notification.session.revoked.title",
            contentKey: "notification.session.revoked.content",
            source: "session",
            templateKey: "session_revoked",
            sendEmail: false,
          })
          .catch((error) => logger.warn({ error: (error as Error)?.message }, "Session batch revoke notification failed"));
      }
    }

    return { affected: result.count, force };
  }

  /**
   * 清理过期/已吊销会话
   * @param beforeDays 保留天数；不传时读系统参数 session_cleanup_keep_days
   */
  async cleanup(beforeDays?: number): Promise<SessionCleanupResult> {
    const fallbackDays = getConfigNumber("session_cleanup_keep_days");
    const days = Math.min(Math.max(Number(beforeDays ?? fallbackDays) || 7, 1), 365);
    const now = new Date();
    const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const result = await prisma.refreshToken.deleteMany({
      where: {
        AND: [{ OR: [{ revoked: true }, { expiresAt: { lt: now } }] }, { createdAt: { lt: threshold } }],
      },
    });

    return { deleted: result.count, beforeDays: days };
  }
}

export default new SessionService();
