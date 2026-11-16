/**
 * ============================================================
 * 菜单树构建工具（utils/menuTree.ts）
 * ------------------------------------------------------------
 * 职责：
 *   1. 把平铺的菜单列表构建为树形结构（parentId 关联）
 *   2. 对用户可见菜单做「祖先补全」：角色只绑定了子菜单时，
 *      自动把其父目录/祖父目录也纳入，保证前端侧边栏层级完整
 * 使用：menu.service（管理端树）、auth.service（登录/Profile 菜单树）
 * ============================================================
 */

/** 菜单树节点（对外返回结构） */
export interface MenuTreeNode {
  id: number;
  parentId: number;
  name: string;
  type: string; // DIR 目录 / MENU 菜单 / BUTTON 按钮
  path: string;
  component: string;
  icon: string;
  menu_group: string; // 菜单分组标识（DIR/MENU 可选；空=前端不渲染）
  permission: string;
  sort: number;
  status: number;
  visible: number;
  children: MenuTreeNode[];
}

/** 平铺菜单的最小字段（Prisma 行 or 手工对象均可） */
export interface FlatMenu {
  id: number;
  parentId: number;
  name: string;
  type: string;
  path: string | null;
  component: string | null;
  icon: string | null;
  group: string | null;
  permission: string | null;
  sort: number;
  status: number;
  visible: number;
}

/** 平铺菜单 → 树形结构（按 sort 升序排列，同一节点下子级随之递归排序） */
export function buildMenuTree(menus: FlatMenu[], rootParentId = 0): MenuTreeNode[] {
  const map = new Map<number, MenuTreeNode>();
  for (const m of menus) {
    map.set(m.id, {
      id: m.id,
      parentId: m.parentId,
      name: m.name,
      type: m.type,
      path: m.path ?? "",
      component: m.component ?? "",
      icon: m.icon ?? "",
      menu_group: m.group ?? "",
      permission: m.permission ?? "",
      sort: m.sort,
      status: m.status,
      visible: m.visible,
      children: [],
    });
  }

  const roots: MenuTreeNode[] = [];
  for (const node of map.values()) {
    const parent = map.get(node.parentId);
    if (node.parentId === rootParentId || !parent) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }

  const sortRec = (list: MenuTreeNode[]): void => {
    list.sort((a, b) => a.sort - b.sort || a.id - b.id);
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/**
 * 祖先补全：给定「用户有权限的菜单 id 集合」，在全量菜单中筛出
 * 这些 id 及其全部祖先（沿 parentId 向上，直到顶级 0）。
 * 用于角色只绑定了子菜单、未绑父目录的场景，保证树层级完整。
 */
export function collectWithAncestors(menuIds: Set<number>, allMenus: FlatMenu[]): FlatMenu[] {
  const byId = new Map<number, FlatMenu>();
  for (const m of allMenus) byId.set(m.id, m);

  const picked = new Set<number>(menuIds);
  // 向上补全祖先（迭代直到不再新增）
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of Array.from(picked)) {
      const menu = byId.get(id);
      if (menu && menu.parentId !== 0 && !picked.has(menu.parentId)) {
        picked.add(menu.parentId);
        changed = true;
      }
    }
  }

  return allMenus.filter((m) => picked.has(m.id));
}
