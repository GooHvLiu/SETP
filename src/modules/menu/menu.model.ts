/**
 * ============================================================
 * 菜单模块类型定义（modules/menu/menu.model.ts）
 * ------------------------------------------------------------
 * TSOA 用 TS 类型自动生成 OpenAPI 文档与参数校验
 * ============================================================
 */

/** 菜单类型：DIR 目录 / MENU 菜单 / BUTTON 按钮 */
export type MenuType = "DIR" | "MENU" | "BUTTON";

/** 新增菜单请求体 */
export interface CreateMenuBody {
  parentId?: number; // 父菜单 id，0 = 顶级
  name: string; // 菜单/权限点名称
  type: MenuType;
  path?: string; // 前端路由路径（DIR/MENU 用）
  component?: string; // 前端组件路径（MENU 用）
  icon?: string;
  menu_group?: string; // 菜单分组标识（DIR/MENU 可选；空=前端不渲染）
  permission?: string; // 权限码，如 superAdmin:menu:create
  sort?: number;
  status?: number; // 1 启用 0 禁用
  visible?: number; // 1 显示 0 隐藏
}

/** 更新菜单请求体 */
export interface UpdateMenuBody {
  parentId?: number;
  name?: string;
  type?: MenuType;
  path?: string;
  component?: string;
  icon?: string;
  menu_group?: string; // 菜单分组标识（DIR/MENU 可选；空=前端不渲染）
  permission?: string;
  sort?: number;
  status?: number;
  visible?: number;
}

/** 菜单记录（扁平，新增返回） */
export interface MenuDto {
  id: number;
  parentId: number;
  name: string;
  type: MenuType;
  path: string | null;
  component: string | null;
  icon: string | null;
  menu_group: string | null; // 菜单分组标识（空=未分组）
  permission: string | null;
  sort: number;
  status: number;
  visible: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 已删除菜单（回收站，扁平结构） */
export interface DeletedMenuDto extends MenuDto {
  deletedAt: Date; // 删除时间（取自 updatedAt）
  parentName: string | null; // 原父级名称；顶级为 null
}
