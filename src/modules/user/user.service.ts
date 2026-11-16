/**
 * ============================================================
 * 用户模块业务逻辑（modules/user/user.service.ts）
 * ------------------------------------------------------------
 * RBAC 版用户管理：
 *   - 分页查询（含角色信息）
 *   - 创建用户（密码哈希 + 绑定角色）
 *   - 更新用户（改密哈希 + 重建角色绑定）
 *   - 软删除
 * 安全：所有输入经 Joi 校验 + Prisma 参数化查询
 * ============================================================
 */

import { prisma } from "@src/db/prisma";
import { DEFAULT_ROLE_LEVEL, ROLE, ROLE_LEVEL, SUPER_ADMIN_USERNAME } from "@src/constants/role";
import { hashPassword, checkPasswordStrength } from "@src/utils/password";
import { TEMPLATE_ADMIN_RESET_PASSWORD } from "@src/constants/password";
import { ERROR_CODE } from "@src/constants/errorCode";
import { BusinessError } from "@src/errors/BusinessError";
import notificationService from "../notification/notification.service";
import logger from "@src/utils/logger";

/** 禁止通过用户管理接口分配 superAdmin 角色（防普通管理员提权） */
function assertAssignableRoles(roleCodes?: string[]) {
  if (roleCodes?.includes(ROLE.SUPER_ADMIN)) {
    throw Object.assign(new Error("Permission denied"), { name: "Forbidden", status: 403 });
  }
}

/** 一组角色编码中的最高层级；无角色返回 -1 */
function maxRoleLevel(roleCodes: string[]): number {
  if (roleCodes.length === 0) return -1;
  return Math.max(...roleCodes.map((code) => ROLE_LEVEL[code] ?? DEFAULT_ROLE_LEVEL));
}

class UserService {
  /**
   * 分页查询用户列表（含角色编码）
   */
  async getList(
    params: { page?: number; pageSize?: number; username?: string; realName?: string; status?: number },
    operatorIsSuper = false
  ) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(Math.max(1, Number(params.pageSize) || 10), 100);
    const offset = (page - 1) * pageSize;

    // 组装查询条件（模糊用户名 + 状态过滤；非超管不可见超级管理员账号）
    const where: any = { isDeleted: 0, ...(!operatorIsSuper ? { isSuper: 0 } : {}) };
    if (params.username) {
      where.username = { contains: params.username };
    }
    if (params.realName) {
      where.realName = { contains: params.realName };
    }

    if (params.status !== undefined) {
      where.status = params.status;
    }

    // 总数 + 列表（并行查询）
    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: pageSize,
        include: {
          roles: { include: { role: true } },
        },
      }),
    ]);

    // 组装返回结构（去掉敏感字段，附角色编码）
    const list = rows.map((u) => ({
      id: u.id,
      username: u.username,
      realName: u.realName,
      email: u.email,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      roles: u.roles.map((r) => r.role.code),
    }));

    return { list, total, page, pageSize };
  }

  /**
   * 根据 ID 获取用户详情（含角色）
   */
  async getById(id: number, operatorIsSuper = false) {
    const user = await prisma.user.findFirst({
      where: { id, isDeleted: 0, ...(!operatorIsSuper ? { isSuper: 0 } : {}) },
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      throw new Error("USER_NOT_EXIST");
    }

    return {
      id: user.id,
      username: user.username,
      realName: user.realName,
      email: user.email,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles: user.roles.map((r) => r.role.code),
    };
  }

  /**
   * 新增用户（密码哈希 + 绑定角色）
   */
  async create(
    body: {
      username: string;
      password: string;
      realName?: string;
      email: string;
      roleCodes?: string[];
    },
    operatorId?: number
  ) {
    // 超级管理员为保留名：禁止创建同名（防伪造隐藏账号）
    if (body.username === SUPER_ADMIN_USERNAME) {
      throw new BusinessError(ERROR_CODE.USER_ALREADY_EXIST, "USER_ALREADY_EXIST", { field: "username" });
    }

    // 用户名查重
    const exist = await prisma.user.findFirst({
      where: { username: body.username, isDeleted: 0 },
    });
    if (exist) {
      throw new BusinessError(ERROR_CODE.USER_ALREADY_EXIST, "USER_ALREADY_EXIST", { field: "username" });
    }

    // 密码强度校验（新账号必须满足强度策略，禁止弱口令）
    const strength = checkPasswordStrength(body.password);
    if (!strength.valid) {
      throw new BusinessError(ERROR_CODE.PASSWORD_WEAK, "PASSWORD_WEAK", { field: "password" });
    }

    // 密码哈希
    const hashedPassword = await hashPassword(body.password);

    // 查角色（未指定默认 viewer）
    const roleCodes = body.roleCodes && body.roleCodes.length > 0 ? body.roleCodes : [ROLE.VIEWER];
    assertAssignableRoles(roleCodes);
    // 只能分配比操作者低级的角色，不能创建同级/更高级账号
    await this.assertCanAssignRoles(roleCodes, operatorId);
    const roles = await prisma.role.findMany({
      where: { code: { in: roleCodes }, status: 1 },
    });
    // 指定的角色必须全部存在且启用，不允许静默降级（防创建成无角色/少角色用户）
    if (roles.length !== roleCodes.length) {
      throw new Error("ROLE_NOT_FOUND");
    }

    // 创建用户 + 绑定角色（事务）
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: body.username,
          passwordHash: hashedPassword,
          realName: body.realName || body.username,
          email: body.email,
          status: 1, // 管理员创建账号直接可用
          mustChangePassword: 1, // 管理员创建账号：首次登录必须先改密
        },
      });

      if (roles.length > 0) {
        await tx.userRole.createMany({
          data: roles.map((r) => ({ userId: created.id, roleId: r.id })),
        });
      }
      return created;
    });

    return this.getById(user.id);
  }

  /**
   * 更新用户（改密哈希 + 重建角色绑定）
   */
  async update(
    id: number,
    body: {
      username?: string;
      realName?: string;
      email?: string;
      status?: number;
      password?: string;
      roleCodes?: string[];
    },
    operatorId?: number
  ) {
    // 超级管理员保护：账号永久不可更改（禁改名/改密/禁用/改绑）
    await this.assertNotSuperAdmin([id]);
    if (body.roleCodes) assertAssignableRoles(body.roleCodes);
    // 角色层级：只能修改比自己低级的账号；修改自己时允许保持同角色（改密/改资料）
    await this.assertCanManageUsers([id], operatorId, { allowSelf: true });
    // 新角色同样只能向下分配，不能把低级账号提升到与操作者同级/更高级
    await this.assertCanAssignRoles(body.roleCodes, operatorId, { allowSameLevel: id === operatorId });

    // 先确认存在
    const target = await this.getById(id);

    // 禁止操作自己：不能禁用自己（避免有权限者自锁死）
    if (operatorId !== undefined && id === operatorId && body.status === 0) {
      throw new Error("USER_SELF_OPERATION_FORBIDDEN");
    }
    // 最后一个管理员保护：禁止禁用或降级最后一个 admin
    if (body.status === 0 || (body.roleCodes !== undefined && !body.roleCodes.includes(ROLE.ADMIN))) {
      await this.assertNotLastAdmin([id]);
    }

    // 用户名变更查重（排除自身）
    if (body.username !== undefined) {
      const exist = await prisma.user.findFirst({
        where: { username: body.username, isDeleted: 0, NOT: { id } },
      });
      if (exist) {
        throw new BusinessError(ERROR_CODE.USER_ALREADY_EXIST, "USER_ALREADY_EXIST", { field: "username" });
      }
    }

    // 改密则先校验强度，再重新哈希
    let hashedPassword: string | undefined;
    if (body.password) {
      const strength = checkPasswordStrength(body.password);
      if (!strength.valid) {
        throw new BusinessError(ERROR_CODE.PASSWORD_WEAK, "PASSWORD_WEAK", { field: "password" });
      }
      hashedPassword = await hashPassword(body.password);
    }

    // 更新基本信息 + 角色绑定（事务）
    // 改密或禁用（status=0）时令牌版本 +1：该用户已签发的令牌立即失效
    const bumpToken = !!(hashedPassword || body.status === 0);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          username: body.username,
          realName: body.realName,
          email: body.email,
          status: body.status,
          ...(hashedPassword ? { passwordHash: hashedPassword } : {}),
          ...(hashedPassword && id !== operatorId ? { mustChangePassword: 1 } : {}),
          ...(bumpToken ? { tokenVersion: { increment: 1 } } : {}),
        },
      });

      // 角色绑定：先删旧绑定，再按新列表重建
      // 指定的角色必须全部存在且启用，不允许静默降级
      if (body.roleCodes) {
        const roles = await tx.role.findMany({
          where: { code: { in: body.roleCodes }, status: 1 },
        });
        if (roles.length !== body.roleCodes.length) {
          throw new Error("ROLE_NOT_FOUND");
        }
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (roles.length > 0) {
          await tx.userRole.createMany({
            data: roles.map((r) => ({ userId: id, roleId: r.id })),
          });
        }
      }
    });

    if (body.status === 0) {
      void notificationService
        .notify({
          userIds: [id],
          category: "security",
          type: "warning",
          title: "",
          content: "",
          titleKey: "notification.user.accountDisabled.title",
          contentKey: "notification.user.accountDisabled.content",
          source: "user",
          templateKey: "account_disabled",
          sendEmail: true,
        })
        .catch((error) => logger.warn({ userId: id, error: (error as Error)?.message }, "Account disabled notification failed"));
    }

    if (hashedPassword && id !== operatorId) {
      void notificationService
        .notify({
          userIds: [id],
          category: "security",
          type: "warning",
          title: "",
          content: "",
          titleKey: "notification.user.passwordAdminReset.title",
          contentKey: "notification.user.passwordAdminReset.content",
          source: "user",
          templateKey: "password_admin_reset",
          sendEmail: true,
        })
        .catch((error) => logger.warn({ userId: id, error: (error as Error)?.message }, "Password admin reset notification failed"));
    }
  }

  /**
   * 管理员重置用户密码：使用模板默认重置口令（见 constants/password.ts）。
   * 重置后 mustChangePassword=1，用户首次登录必须改密；旧会话立即失效。
   */
  async resetPassword(id: number, operatorId?: number) {
    await this.assertNotSuperAdmin([id]);
    await this.assertCanManageUsers([id], operatorId);
    const target = await this.getById(id);
    const resetPassword = process.env.ADMIN_RESET_PASSWORD || TEMPLATE_ADMIN_RESET_PASSWORD;

    const hashedPassword = await hashPassword(resetPassword);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          passwordHash: hashedPassword,
          mustChangePassword: 1,
          tokenVersion: { increment: 1 },
        },
      });
      await tx.refreshToken.updateMany({ where: { userId: id, revoked: false }, data: { revoked: true } });
      // 清空失败计数与锁定，保证用户能立即用初始密码登录
      await tx.loginAttempt.deleteMany({ where: { username: target.username } });
    });

    void notificationService
      .notify({
        userIds: [id],
        category: "security",
        type: "warning",
        title: "",
        content: "",
        titleKey: "notification.user.passwordAdminReset.title",
        contentKey: "notification.user.passwordAdminReset.content",
        source: "user",
        templateKey: "password_admin_reset",
        sendEmail: true,
      })
      .catch((error) => logger.warn({ userId: id, error: (error as Error)?.message }, "Password reset notification failed"));

    return { username: target.username, mustChangePassword: true };
  }

  /**
   * 审核通过自助注册账号：status=2 → 1，首次登录仍强制改密。
   * 已通过（status=1）幂等返回；已禁用（status=0）拒绝。
   */
  async approve(id: number, operatorId?: number) {
    await this.assertNotSuperAdmin([id]);
    await this.assertCanManageUsers([id], operatorId);

    const target = await this.getById(id);
    if (target.status === 0) {
      throw new Error("USER_DISABLED");
    }
    if (target.status === 1) {
      return target;
    }
    if (target.status !== 2) {
      throw new Error("USER_NOT_PENDING_APPROVAL");
    }

    await prisma.user.update({
      where: { id },
      data: {
        status: 1,
        mustChangePassword: 1,
        tokenVersion: { increment: 1 },
      },
    });

    void notificationService
      .notify({
        userIds: [id],
        category: "business",
        type: "success",
        title: "",
        content: "",
        titleKey: "notification.user.registerApproved.title",
        contentKey: "notification.user.registerApproved.content",
        source: "user",
        templateKey: "register_approved",
        sendEmail: true,
      })
      .catch((error) => logger.warn({ userId: id, error: (error as Error)?.message }, "Register approved notification failed"));

    return this.getById(id);
  }

  /**
   * 驳回复助注册账号：status=2 → 0（禁用），不引入第四种状态。
   * 已禁用（status=0）幂等返回；已通过（status=1）不允许再走驳回。
   */
  async reject(id: number, operatorId?: number) {
    await this.assertNotSuperAdmin([id]);
    await this.assertCanManageUsers([id], operatorId);

    const target = await this.getById(id);
    if (target.status === 0) {
      return target;
    }
    if (target.status !== 2) {
      throw new Error("USER_NOT_PENDING_APPROVAL");
    }

    await prisma.user.update({
      where: { id },
      data: {
        status: 0,
        mustChangePassword: 1,
        tokenVersion: { increment: 1 },
      },
    });

    void notificationService
      .notify({
        userIds: [id],
        category: "business",
        type: "warning",
        title: "",
        content: "",
        titleKey: "notification.user.registerRejected.title",
        contentKey: "notification.user.registerRejected.content",
        source: "user",
        templateKey: "register_rejected",
        sendEmail: true,
      })
      .catch((error) => logger.warn({ userId: id, error: (error as Error)?.message }, "Register rejected notification failed"));

    return this.getById(id);
  }

  /**
   * 删除用户（软删除 + 清理角色绑定）
   * 注意：必须同时清理 user_roles，否则软删用户会一直占用角色，
   *      导致该角色后续无法删除（ROLE_IN_USE）
   */
  async delete(id: number, operatorId?: number) {
    // 禁止删除自己
    if (operatorId !== undefined && id === operatorId) {
      throw new Error("USER_SELF_OPERATION_FORBIDDEN");
    }
    // 最后一个管理员保护
    await this.assertNotLastAdmin([id]);
    // 超级管理员保护：禁止删除隐藏账号
    await this.assertNotSuperAdmin([id]);
    // 角色层级：只能删除比自己低级的账号
    await this.assertCanManageUsers([id], operatorId);

    await this.getById(id);
    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId: id } }),
      prisma.user.update({
        where: { id },
        data: { isDeleted: 1, deletedAt: new Date(), tokenVersion: { increment: 1 } },
      }),
    ]);
  }

  /**
   * 批量删除用户（软删除 + 清理角色绑定）
   * 任一 id 不存在即整体拒绝，避免静默部分成功
   */
  async deleteBatch(ids: number[], operatorId?: number) {
    // 去重后再校验/统计，避免重复 id 被误判为“用户不存在”
    const targetIds = Array.from(new Set(ids));
    // 禁止批量删除中包含自己
    if (operatorId !== undefined && targetIds.includes(operatorId)) {
      throw new Error("USER_SELF_OPERATION_FORBIDDEN");
    }
    // 最后一个管理员保护：删除列表覆盖全部启用 admin 时拒绝
    await this.assertNotLastAdmin(targetIds);

    const existing = await prisma.user.findMany({
      where: { id: { in: targetIds }, isDeleted: 0 },
      select: { id: true },
    });
    if (existing.length !== targetIds.length) {
      throw new Error("USER_NOT_EXIST");
    }
    // 超级管理员保护：禁止批量删除隐藏账号
    await this.assertNotSuperAdmin(targetIds);
    // 角色层级：批量删除同样只能删除比自己低级的账号
    await this.assertCanManageUsers(targetIds, operatorId);

    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId: { in: targetIds } } }),
      prisma.user.updateMany({
        where: { id: { in: targetIds } },
        data: { isDeleted: 1, deletedAt: new Date(), tokenVersion: { increment: 1 } },
      }),
    ]);
    return { deleted: targetIds.length };
  }

  /**
   * 读取操作者的最高角色层级。
   * 超管账号按最高级处理；账号不存在或没有角色返回 -1（后续直接拒绝）。
   */
  private async getActorLevel(operatorId?: number): Promise<number> {
    if (operatorId === undefined) return -1;
    const actor = await prisma.user.findFirst({
      where: { id: operatorId, isDeleted: 0 },
      select: {
        isSuper: true,
        roles: { select: { role: { select: { code: true } } } },
      },
    });
    if (!actor) return -1;
    if (actor.isSuper === 1) return ROLE_LEVEL[ROLE.SUPER_ADMIN];
    return maxRoleLevel(actor.roles.map((item) => item.role.code));
  }

  /**
   * 只能操作比自己低级的账号：
   *   - 目标角色层级 >= 操作者层级 → 拒绝（同角色、同级别、更高角色都不行）
   *   - allowSelf=true 时放行操作者本人（用于自助改密/改资料）
   */
  private async assertCanManageUsers(userIds: number[], operatorId?: number, options: { allowSelf?: boolean } = {}): Promise<void> {
    if (userIds.length === 0) return;

    const targetIds = Array.from(new Set(userIds));
    const actorLevel = await this.getActorLevel(operatorId);
    if (actorLevel < 0) {
      throw new Error("USER_ROLE_LEVEL_FORBIDDEN");
    }

    const targets = await prisma.user.findMany({
      where: { id: { in: targetIds }, isDeleted: 0 },
      select: {
        id: true,
        isSuper: true,
        roles: { select: { role: { select: { code: true } } } },
      },
    });
    if (targets.length !== targetIds.length) {
      throw new Error("USER_NOT_EXIST");
    }

    for (const target of targets) {
      if (options.allowSelf && target.id === operatorId) continue;
      if (target.isSuper === 1) {
        throw new Error("SUPER_ADMIN_PROTECTED");
      }
      const targetLevel = maxRoleLevel(target.roles.map((item) => item.role.code));
      if (targetLevel >= actorLevel) {
        throw new Error("USER_ROLE_LEVEL_FORBIDDEN");
      }
    }
  }

  /**
   * 新分配的角色必须低于操作者层级。
   * allowSameLevel=true 仅用于操作者修改自己：允许保留当前同级角色（如 admin 改自己的密码）。
   */
  private async assertCanAssignRoles(
    roleCodes: string[] | undefined,
    operatorId?: number,
    options: { allowSameLevel?: boolean } = {}
  ): Promise<void> {
    if (!roleCodes || roleCodes.length === 0) return;

    const actorLevel = await this.getActorLevel(operatorId);
    if (actorLevel < 0) {
      throw new Error("USER_ROLE_LEVEL_FORBIDDEN");
    }

    const requestedLevel = maxRoleLevel(roleCodes);
    if (requestedLevel > actorLevel || (!options.allowSameLevel && requestedLevel === actorLevel)) {
      throw new Error("USER_ROLE_LEVEL_FORBIDDEN");
    }
  }

  /**
   * 最后管理员保护：目标用户持有 admin 角色，且操作将覆盖系统全部启用 admin 时拒绝
   * 防止删除/禁用/降级最后一个管理员后系统无人可管理
   */
  private async assertNotLastAdmin(userIds: number[]): Promise<void> {
    if (userIds.length === 0) return;
    const adminInTargets = await prisma.userRole.count({
      where: { userId: { in: userIds }, role: { code: ROLE.ADMIN }, user: { isDeleted: 0 } },
    });
    if (adminInTargets === 0) return;

    const adminTotal = await prisma.userRole.count({
      where: { role: { code: ROLE.ADMIN }, user: { isDeleted: 0 } },
    });
    if (adminInTargets >= adminTotal) {
      throw new Error("ADMIN_LAST_PROTECTED");
    }
  }

  /**
   * 超级管理员保护：目标用户含 is_super=1（隐藏账号）时拒绝操作
   * 覆盖 update / delete / deleteBatch，保证超级管理员永久不可更改
   */
  private async assertNotSuperAdmin(userIds: number[]): Promise<void> {
    if (userIds.length === 0) return;
    const superCount = await prisma.user.count({ where: { id: { in: userIds }, isSuper: 1 } });
    if (superCount > 0) {
      throw new Error("SUPER_ADMIN_PROTECTED");
    }
  }
}

export default new UserService();
