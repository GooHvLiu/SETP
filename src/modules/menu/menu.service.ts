/**
 * ============================================================
 * 菜单业务逻辑（modules/menu/menu.service.ts）
 * ------------------------------------------------------------
 * 职责（RBAC 菜单闭环）：
 *   1. getTreeByUser：当前用户可见菜单树（登录/Profile 返回，
 *      前端据此生成动态路由；只含 DIR/MENU，按钮权限走权限码）
 *   2. getList：管理端全量菜单树（含按钮，配置菜单用）
 *   3. getDeletedList：已删除菜单清单（回收站）
 *   4. create / update / delete / restore：菜单增删改与恢复
 *
 * 统一规则（四模板一致）：
 *   - 类型联动：DIR 必填 path；MENU 必填 path / component / permission
 *     （外链菜单 component 必须为空）；BUTTON 必填 parentId / permission，
 *     path / component 必须为空且 visible 固定 0。
 *   - path 唯一：非空 path 在未删除菜单中全局唯一（含外链地址）。
 *   - 删除为软删并清理 role_menus；恢复只恢复节点本身，不恢复角色绑定。
 * ============================================================
 */

import { prisma } from "@src/db/prisma";
import { buildMenuTree, collectWithAncestors, FlatMenu, MenuTreeNode } from "@src/utils/menuTree";
import { CreateMenuBody, UpdateMenuBody, MenuDto, MenuType, DeletedMenuDto } from "./menu.model";
import { BusinessError } from "../../errors/BusinessError";
import { ERROR_CODE } from "../../constants/errorCode";

/** 类型联动校验所需的有效字段集合（更新时由旧值 + 本次入参合并得到） */
interface MenuFieldState {
  parentId: number;
  type: MenuType;
  path: string;
  component: string;
  permission: string;
  visible: number;
}

class MenuService {
  /**
   * 当前用户可见菜单树（DIR/MENU，status=1 visible=1）
   * 角色绑定菜单后，未绑定的祖先目录会自动补全，保证层级完整
   */
  async getTreeByUser(userId: number): Promise<MenuTreeNode[]> {
    // 1. 查用户角色绑定的菜单 id 集合
    const userRoles = await prisma.userRole.findMany({
      where: { userId, role: { status: 1 } },
      include: { role: { include: { menus: { select: { menuId: true } } } } },
    });
    const menuIds = new Set<number>();
    for (const ur of userRoles) {
      for (const rm of ur.role.menus) menuIds.add(rm.menuId);
    }
    if (menuIds.size === 0) return [];

    // 2. 全量启用菜单（不含按钮，按钮仅作权限点，前端动态路由不需要）
    const allMenus = await prisma.menu.findMany({
      where: { isDeleted: 0, status: 1, type: { in: ["DIR", "MENU"] } },
      orderBy: { sort: "asc" },
    });

    // 3. 用户菜单 + 祖先补全 → 建树
    const flat: FlatMenu[] = collectWithAncestors(menuIds, allMenus as unknown as FlatMenu[]).filter((m) => m.visible === 1);
    return buildMenuTree(flat);
  }

  /**
   * 管理端全量菜单树（含按钮，配置菜单界面用）
   */
  async getList(): Promise<MenuTreeNode[]> {
    const all = await prisma.menu.findMany({
      where: { isDeleted: 0 },
      orderBy: { sort: "asc" },
    });
    return buildMenuTree(all as unknown as FlatMenu[]);
  }

  /**
   * 已删除菜单清单（回收站，扁平结构，按删除时间倒序）
   * parentName 供前端展示“原父级”；父级本身也可能在回收站中
   */
  async getDeletedList(): Promise<DeletedMenuDto[]> {
    const rows = await prisma.menu.findMany({
      where: { isDeleted: 1 },
      orderBy: { updatedAt: "desc" },
    });
    const all = await prisma.menu.findMany({ select: { id: true, name: true } });
    const nameMap = new Map<number, string>(all.map((m) => [m.id, m.name]));
    return rows.map((row) => this.toDeletedDto(row, nameMap));
  }

  /**
   * 新增菜单（类型联动校验 → 同级同名查重 → path 唯一 → 权限码唯一）
   */
  async create(body: CreateMenuBody) {
    const parentId = body.parentId || 0;
    if (parentId !== 0) {
      await this.assertParent(parentId);
    }

    const state: MenuFieldState = {
      parentId,
      type: body.type,
      path: (body.path ?? "").trim(),
      component: (body.component ?? "").trim(),
      permission: (body.permission ?? "").trim(),
      visible: body.type === "BUTTON" ? 0 : (body.visible ?? 1),
    };
    this.assertTypeFields(state);

    // 同级同名查重（避免前端菜单显示混乱）
    const exist = await prisma.menu.findFirst({
      where: { parentId, name: body.name, isDeleted: 0 },
    });
    if (exist) {
      throw new BusinessError(ERROR_CODE.MENU_EXIST, "MENU_EXIST", { field: "name" });
    }

    await this.assertPathUnique(state.path);
    if (state.permission) {
      await this.assertPermissionUnique(state.permission);
    }

    const created = await prisma.menu.create({
      data: {
        parentId,
        name: body.name,
        type: state.type,
        path: state.path,
        component: state.component,
        icon: body.icon ?? "",
        // Prisma model 字段名 group（DB 列名 menu_group，@map 映射）
        group: body.menu_group ?? "",
        permission: state.permission,
        sort: body.sort ?? 0,
        status: body.status ?? 1,
        visible: state.visible,
      },
    });
    return this.toMenuDto(created);
  }

  /**
   * 更新菜单（parentId 变更时校验环路；按合并后的有效字段做类型联动校验）
   */
  async update(id: number, body: UpdateMenuBody) {
    const current = await this.assertMenuExists(id);
    const nextParentId = body.parentId !== undefined ? body.parentId || 0 : current.parentId;

    if (body.parentId !== undefined) {
      if (nextParentId === id) {
        this.fieldError("parentId");
      }
      // 校验新父节点不能是自己的后代
      const descendants = await this.getDescendantIds(id);
      if (descendants.has(nextParentId)) {
        this.fieldError("parentId");
      }
      if (nextParentId !== 0) {
        await this.assertParent(nextParentId);
      }
    }

    const nextType = (body.type ?? current.type) as MenuType;
    const state: MenuFieldState = {
      parentId: nextParentId,
      type: nextType,
      path: body.path !== undefined ? body.path.trim() : (current.path ?? "").trim(),
      component: body.component !== undefined ? body.component.trim() : (current.component ?? "").trim(),
      permission: body.permission !== undefined ? body.permission.trim() : (current.permission ?? "").trim(),
      // BUTTON 固定 visible=0，忽略入参；切到 BUTTON 时同样归零
      visible: nextType === "BUTTON" ? 0 : (body.visible ?? current.visible),
    };
    this.assertTypeFields(state);
    await this.assertPathUnique(state.path, id);
    if (state.permission) {
      await this.assertPermissionUnique(state.permission, id);
    }

    // 同级名称查重（更新时也要守住，避免同级重名菜单）
    const nextName = (body.name ?? current.name).trim();
    const sibling = await prisma.menu.findFirst({
      where: { parentId: nextParentId, name: nextName, isDeleted: 0, id: { not: id } },
      select: { id: true },
    });
    if (sibling) {
      throw new BusinessError(ERROR_CODE.MENU_EXIST, "MENU_EXIST", { field: "name" });
    }

    const updated = await prisma.menu.update({
      where: { id },
      data: {
        parentId: body.parentId,
        name: body.name,
        type: body.type,
        path: body.path !== undefined ? body.path.trim() : undefined,
        component: body.component !== undefined ? body.component.trim() : undefined,
        icon: body.icon,
        group: body.menu_group,
        permission: body.permission !== undefined ? body.permission.trim() : undefined,
        sort: body.sort,
        status: body.status,
        visible: state.visible,
      },
    });
    return this.toMenuDto(updated);
  }

  /**
   * 删除菜单：有子菜单拒绝；软删本体并清理 role_menus 关联
   * 删除后 path / permission 释放，可被新菜单复用
   */
  async delete(id: number) {
    await this.assertMenuExists(id);

    const childCount = await prisma.menu.count({
      where: { parentId: id, isDeleted: 0 },
    });
    if (childCount > 0) {
      throw new BusinessError(ERROR_CODE.MENU_HAS_CHILDREN, "MENU_HAS_CHILDREN");
    }

    await prisma.$transaction([
      prisma.roleMenu.deleteMany({ where: { menuId: id } }),
      prisma.menu.update({ where: { id }, data: { isDeleted: 1 } }),
    ]);
  }

  /**
   * 恢复已删除菜单
   * 只恢复节点本身：删除时已清理 role_menus，恢复后需重新分配角色
   * 父节点仍在回收站时拒绝，要求先恢复父节点
   */
  async restore(id: number): Promise<MenuDto> {
    const row = await prisma.menu.findFirst({ where: { id } });
    if (!row) {
      throw new BusinessError(ERROR_CODE.MENU_NOT_FOUND, "MENU_NOT_FOUND");
    }
    if (row.isDeleted === 0) {
      throw new BusinessError(ERROR_CODE.MENU_NOT_DELETED, "MENU_NOT_DELETED");
    }

    if (row.parentId !== 0) {
      const parent = await prisma.menu.findFirst({
        where: { id: row.parentId, isDeleted: 0 },
      });
      if (!parent) {
        throw new BusinessError(ERROR_CODE.MENU_PARENT_DELETED, "MENU_PARENT_DELETED");
      }
    }

    const nameDup = await prisma.menu.findFirst({
      where: { parentId: row.parentId, name: row.name, isDeleted: 0 },
    });
    if (nameDup) {
      throw new BusinessError(ERROR_CODE.MENU_EXIST, "MENU_EXIST", { field: "name" });
    }

    if (row.permission) {
      const permDup = await prisma.menu.findFirst({
        where: { permission: row.permission, isDeleted: 0 },
      });
      if (permDup) {
        throw new BusinessError(ERROR_CODE.MENU_PERMISSION_EXIST, "MENU_PERMISSION_EXIST", { field: "permission" });
      }
    }

    if (row.path) {
      const pathDup = await prisma.menu.findFirst({
        where: { path: row.path, isDeleted: 0 },
      });
      if (pathDup) {
        throw new BusinessError(ERROR_CODE.MENU_PATH_EXIST, "MENU_PATH_EXIST", { field: "path" });
      }
    }

    const restored = await prisma.menu.update({
      where: { id },
      data: { isDeleted: 0 },
    });
    return this.toMenuDto(restored);
  }

  /** 行 → 对外契约：菜单分组字段统一输出 menu_group，内部软删标记不外泄 */
  private toMenuDto(row: any): MenuDto {
    const { group, isDeleted, ...rest } = row;
    return { ...rest, menu_group: group } as MenuDto;
  }

  /** 已删除行 → 回收站契约（补 deletedAt 与 parentName） */
  private toDeletedDto(row: any, nameMap: Map<number, string>): DeletedMenuDto {
    const dto = this.toMenuDto(row);
    return {
      ...dto,
      deletedAt: dto.updatedAt,
      parentName: dto.parentId ? (nameMap.get(dto.parentId) ?? null) : null,
    };
  }

  /** 字段级参数错误：10003 + params.field，前端可精确提示 */
  private fieldError(field: string): never {
    throw new BusinessError(ERROR_CODE.PARAM_INVALID, "PARAM_INVALID", { field });
  }

  /** 外链地址（http/https） */
  private isExternalPath(path: string): boolean {
    return /^https?:\/\//i.test(path);
  }

  /** path 格式：站内必须以 / 开头、单斜杠、无尾斜杠；外链仅允许 MENU */
  private assertPathFormat(path: string, type: MenuType): void {
    if (this.isExternalPath(path)) {
      if (type === "DIR") this.fieldError("path");
      if (/\s/.test(path)) this.fieldError("path");
      return;
    }
    if (!path.startsWith("/")) this.fieldError("path");
    if (path.length > 1 && path.endsWith("/")) this.fieldError("path");
    if (path.includes("//")) this.fieldError("path");
    if (/\s/.test(path)) this.fieldError("path");
  }

  /**
   * 类型联动必填校验
   * DIR    ：path 必填（仅站内路径），component / permission 可选
   * MENU   ：path / permission 必填；站内必须 component，外链 component 必须为空
   * BUTTON ：parentId / permission 必填；path / component 必须为空；visible 固定 0
   */
  private assertTypeFields(state: MenuFieldState): void {
    const { parentId, type, path, component, permission, visible } = state;

    if (type === "BUTTON") {
      if (parentId === 0) this.fieldError("parentId");
      if (path) this.fieldError("path");
      if (component) this.fieldError("component");
      if (!permission) this.fieldError("permission");
      if (visible !== 0) this.fieldError("visible");
      return;
    }

    if (!path) this.fieldError("path");
    this.assertPathFormat(path, type);

    if (type === "MENU") {
      if (!permission) this.fieldError("permission");
      if (this.isExternalPath(path)) {
        if (component) this.fieldError("component");
      } else if (!component) {
        this.fieldError("component");
      }
    }

    if (permission && /\s/.test(permission)) this.fieldError("permission");
  }

  /** 父节点必须存在且不是按钮（按钮不能有子节点） */
  private async assertParent(parentId: number): Promise<void> {
    const parent = await prisma.menu.findFirst({
      where: { id: parentId, isDeleted: 0 },
    });
    if (!parent) {
      throw new BusinessError(ERROR_CODE.MENU_NOT_FOUND, "MENU_NOT_FOUND");
    }
    if (parent.type === "BUTTON") {
      this.fieldError("parentId");
    }
  }

  /** path 唯一：未删除菜单中全局唯一，更新时排除自身 */
  private async assertPathUnique(path: string, excludeId?: number): Promise<void> {
    if (!path) return;
    const dup = await prisma.menu.findFirst({
      where: { path, isDeleted: 0, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (dup) {
      throw new BusinessError(ERROR_CODE.MENU_PATH_EXIST, "MENU_PATH_EXIST", { field: "path" });
    }
  }

  /** 权限码唯一：未删除菜单中唯一，更新时排除自身 */
  private async assertPermissionUnique(permission: string, excludeId?: number): Promise<void> {
    const dup = await prisma.menu.findFirst({
      where: { permission, isDeleted: 0, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (dup) {
      throw new BusinessError(ERROR_CODE.MENU_PERMISSION_EXIST, "MENU_PERMISSION_EXIST", { field: "permission" });
    }
  }

  /** 校验菜单存在（未软删） */
  private async assertMenuExists(id: number) {
    const menu = await prisma.menu.findFirst({ where: { id, isDeleted: 0 } });
    if (!menu) {
      throw new BusinessError(ERROR_CODE.MENU_NOT_FOUND, "MENU_NOT_FOUND");
    }
    return menu;
  }

  /** 获取某菜单的全部后代 id（含自身，用于环路校验） */
  private async getDescendantIds(id: number): Promise<Set<number>> {
    const all = await prisma.menu.findMany({ where: { isDeleted: 0 }, select: { id: true, parentId: true } });
    const childrenMap = new Map<number, number[]>();
    for (const m of all) {
      const list = childrenMap.get(m.parentId) ?? [];
      list.push(m.id);
      childrenMap.set(m.parentId, list);
    }

    const result = new Set<number>([id]);
    const queue = [id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const child of childrenMap.get(cur) ?? []) {
        if (!result.has(child)) {
          result.add(child);
          queue.push(child);
        }
      }
    }
    return result;
  }
}

export default new MenuService();
