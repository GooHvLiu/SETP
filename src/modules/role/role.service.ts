/**
 * ============================================================
 * 角色业务逻辑（modules/role/role.service.ts）
 * ------------------------------------------------------------
 * 职责（RBAC 角色闭环）：
 *   1. getList / getById：角色列表与详情（含绑定的菜单 id）
 *   2. create：新增角色 + 绑定菜单
 *   3. update：更新角色 + 重建菜单绑定（menuIds 传入即整体重建）
 *   4. delete：删除角色（有用户引用时拒绝，防孤儿数据）
 *   5. assignMenus：单独重建某角色的菜单绑定
 * 使用：与 user 模块的 roleCodes 分配配合，形成完整 RBAC
 * ============================================================
 */

import { prisma } from "@src/db/prisma";
import { CreateRoleBody, UpdateRoleBody } from "./role.model";

class RoleService {
  /**
   * 角色列表（含绑定菜单 id 与权限码）
   */
  async getList() {
    const roles = await prisma.role.findMany({
      orderBy: { id: "asc" },
      include: { menus: { include: { menu: true } } },
    });

    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      menuIds: r.menus.map((rm) => rm.menuId),
      permissions: r.menus.map((rm) => rm.menu.permission).filter((p): p is string => !!p),
    }));
  }

  /**
   * 角色详情（含绑定菜单 id 与权限码）
   */
  async getById(id: number) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: { menus: { include: { menu: true } } },
    });
    if (!role) {
      throw new Error("ROLE_NOT_FOUND");
    }

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      status: role.status,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      menuIds: role.menus.map((rm) => rm.menuId),
      permissions: role.menus.map((rm) => rm.menu.permission).filter((p): p is string => !!p),
    };
  }

  /**
   * 新增角色 + 绑定菜单（事务）
   */
  async create(body: CreateRoleBody) {
    // 角色编码查重
    const exist = await prisma.role.findUnique({ where: { code: body.code } });
    if (exist) {
      throw new Error("ROLE_CODE_EXIST");
    }

    if (body.menuIds && body.menuIds.length > 0) {
      await this.assertMenusExist(body.menuIds);
    }

    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          code: body.code,
          name: body.name,
          description: body.description || "",
          status: body.status ?? 1,
        },
      });

      if (body.menuIds && body.menuIds.length > 0) {
        await tx.roleMenu.createMany({
          data: body.menuIds.map((menuId) => ({ roleId: created.id, menuId })),
        });
      }
      return created;
    });

    return this.getById(role.id);
  }

  /**
   * 更新角色（基本信息；menuIds 传入则整体重建菜单绑定）
   */
  async update(id: number, body: UpdateRoleBody) {
    const role = await this.getById(id); // 不存在则抛 ROLE_NOT_FOUND

    // 内置角色保护：admin/operator/viewer 禁止停用；菜单绑定允许由 superAdmin 重新分配
    const isBuiltin = role.code === "admin" || role.code === "operator" || role.code === "viewer";
    if (isBuiltin && body.status === 0) {
      throw new Error("ROLE_SYSTEM_PROTECTED");
    }
    // 菜单存在性校验（防 role_menus 外键脏数据；重复 id 先去重，避免误报）
    if (body.menuIds && body.menuIds.length > 0) {
      await this.assertMenusExist(body.menuIds);
    }

    await prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
          status: body.status,
        },
      });

      // 整体重建绑定：先删旧，再按新列表写入（去重，防复合主键冲突）
      if (body.menuIds) {
        const menuIds = Array.from(new Set(body.menuIds));
        await tx.roleMenu.deleteMany({ where: { roleId: id } });
        if (menuIds.length > 0) {
          await tx.roleMenu.createMany({
            data: menuIds.map((menuId) => ({ roleId: id, menuId })),
          });
        }
      }
    });
  }

  /**
   * 删除角色（被用户引用时拒绝，防孤儿数据）
   */
  async delete(id: number) {
    const role = await this.getById(id);
    // 内置角色（seed 固定 admin/operator/viewer）禁止删除，防权限体系被拆解
    if (role.code === "admin" || role.code === "operator" || role.code === "viewer") {
      throw new Error("ROLE_SYSTEM_PROTECTED");
    }

    const userCount = await prisma.userRole.count({ where: { roleId: id } });
    if (userCount > 0) {
      throw new Error("ROLE_IN_USE");
    }

    await prisma.$transaction([prisma.roleMenu.deleteMany({ where: { roleId: id } }), prisma.role.delete({ where: { id } })]);
  }

  /**
   * 单独重建某角色的菜单绑定（角色分配界面用）
   */
  async assignMenus(id: number, menuIds: number[]) {
    await this.getById(id);

    // 内置角色允许由 superAdmin 重新分配菜单；仅删除/停用受保护
    if (menuIds.length > 0) {
      await this.assertMenusExist(menuIds);
    }

    await prisma.$transaction(async (tx) => {
      await tx.roleMenu.deleteMany({ where: { roleId: id } });
      if (menuIds.length > 0) {
        await tx.roleMenu.createMany({
          data: menuIds.map((menuId) => ({ roleId: id, menuId })),
        });
      }
    });
  }
  /**
   * 按权限码整体重建某角色的菜单绑定（角色分配界面用，权限码 ↔ 菜单映射）
   */
  async assignPermissions(id: number, permissionCodes: string[]) {
    await this.getById(id);

    // 内置角色允许由 superAdmin 重新分配权限；仅删除/停用受保护
    // 权限码去重后校验全部存在（防脏数据）
    const codes = Array.from(new Set(permissionCodes));
    const menus = await prisma.menu.findMany({
      where: { permission: { in: codes }, isDeleted: 0 },
      select: { id: true },
    });
    if (menus.length !== codes.length) {
      throw new Error("MENU_NOT_FOUND");
    }
    const menuIds = menus.map((m) => m.id);

    await prisma.$transaction(async (tx) => {
      await tx.roleMenu.deleteMany({ where: { roleId: id } });
      if (menuIds.length > 0) {
        await tx.roleMenu.createMany({
          data: menuIds.map((menuId) => ({ roleId: id, menuId })),
        });
      }
    });
  }

  /** 校验菜单 id 全部存在（未软删），否则抛 MENU_NOT_FOUND（防 role_menus 外键脏数据） */
  private async assertMenusExist(menuIds: number[]): Promise<void> {
    const uniqueIds = Array.from(new Set(menuIds));
    const menus = await prisma.menu.findMany({
      where: { id: { in: uniqueIds }, isDeleted: 0 },
      select: { id: true },
    });
    if (menus.length !== uniqueIds.length) {
      throw new Error("MENU_NOT_FOUND");
    }
  }
}

export default new RoleService();
