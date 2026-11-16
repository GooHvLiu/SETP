/**
 * ============================================================
 * RBAC 菜单/角色 临时验证脚本（test/verify-rbac.ts）
 * ------------------------------------------------------------
 * 用途：验证 menu / role 模块核心链路（service 层直连）
 * 覆盖：
 *   1. menuService.getList        全量菜单树（含按钮）
 *   2. menuService.getTreeByUser  admin 完整树 / viewer 受限树（祖先补全）
 *   3. menuService.create/update/delete  菜单 CRUD
 *   4. roleService.getList/create/update/assignMenus/delete  角色闭环
 * 注意：验证过程会创建临时数据，结束时全部清理
 * 运行：npx tsx test/verify-rbac.ts
 * ============================================================
 */

import { prisma } from "../src/db/prisma";
import menuService from "../src/modules/menu/menu.service";
import roleService from "../src/modules/role/role.service";
import userService from "../src/modules/user/user.service";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: any) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}`, extra ?? "");
  }
}

async function main() {
  // ---------- 1. 全量菜单树（管理端） ----------
  console.log("\n[1] menuService.getList 全量菜单树");
  const allTree = await menuService.getList();
  const hasMenuManage = JSON.stringify(allTree).includes("menu.menu.superAdmin.menuCenter");
  const hasRoleManage = JSON.stringify(allTree).includes("menu.menu.superAdmin.roleCenter");
  const hasButton = JSON.stringify(allTree).includes("superAdmin:menu:create");
  check("包含 菜单管理", hasMenuManage);
  check("包含 角色管理", hasRoleManage);
  check("包含按钮权限点 superAdmin:menu:create", hasButton);
  console.log(`     根节点数: ${allTree.length}`);

  // ---------- 2. admin 用户菜单树 ----------
  console.log("\n[2] menuService.getTreeByUser(admin)");
  const admin = await prisma.user.findFirst({ where: { username: "admin" } });
  check("admin 用户存在", !!admin);
  if (admin) {
    const adminTree = await menuService.getTreeByUser(admin.id);
    const flat = JSON.stringify(adminTree);
    check("admin 树含 系统管理", flat.includes("menu.menu.adminCenter.title"));
    check("admin 树不含 菜单管理(已收缩给 superAdmin)", !flat.includes("menu.menu.superAdmin.menuCenter"));
    check("admin 树不含 角色管理(已收缩给 superAdmin)", !flat.includes("menu.menu.superAdmin.roleCenter"));
    check("admin 树不含按钮(纯 DIR/MENU)", !flat.includes("superAdmin:menu:create"));
    console.log(`     根节点数: ${adminTree.length}`);
  }
  // ---------- 2.5 superAdmin 隐藏 + 保护 ----------
  console.log("\n[2.5] superAdmin 隐藏账号 + 保护");
  const superUser = await prisma.user.findFirst({ where: { username: "superAdmin" } });
  check("superAdmin 账号存在", !!superUser);
  if (superUser) {
    check("superAdmin is_super=1", superUser.isSuper === 1);
    const normalList = await userService.getList({ page: 1, pageSize: 50 });
    check("非超管列表不含 superAdmin", !((normalList as any)?.list || []).some((u: any) => u.username === "superAdmin"));
    const superList = await userService.getList({ page: 1, pageSize: 50 }, true);
    check(
      "超管视角列表含 superAdmin",
      ((superList as any)?.list || []).some((u: any) => u.username === "superAdmin")
    );
    let delRejected = false;
    try {
      await userService.delete(superUser.id);
    } catch (e: any) {
      delRejected = e?.message === "SUPER_ADMIN_PROTECTED";
    }
    check("删除 superAdmin 被拦截(SUPER_ADMIN_PROTECTED)", delRejected);
    let updRejected = false;
    try {
      await userService.update(superUser.id, { email: "hack@test.com" });
    } catch (e: any) {
      updRejected = e?.message === "SUPER_ADMIN_PROTECTED";
    }
    check("修改 superAdmin 被拦截(SUPER_ADMIN_PROTECTED)", updRejected);
  }

  // ---------- 2.6 superAdmin 菜单层级（超级设置 + 超级管理 DIR → 9 项） ----------
  console.log("\n[2.6] superAdmin 菜单层级");
  if (superUser) {
    const superTree = await menuService.getTreeByUser(superUser.id);
    const settingsNode: any = superTree.find((n: any) => n.name === "menu.menu.superSettings");
    const dirNode: any = superTree.find((n: any) => n.name === "menu.menu.superAdmin.title");
    check("含 超级设置节点", JSON.stringify(superTree).includes("menu.menu.superSettings"));
    check("超级设置为 MENU 且无子项", settingsNode?.type === "MENU" && (settingsNode?.children || []).length === 0);
    check("超级管理为 DIR 且下辖 9 项", dirNode?.type === "DIR" && (dirNode?.children || []).length === 9);
    check(
      "九项图标与分组均为空",
      (dirNode?.children || []).every((c: any) => !c.icon && !(c.menu_group ?? c.group))
    );
  }
  // ---------- 3. viewer 受限树（祖先补全） ----------
  console.log("\n[3] viewer 受限菜单树");
  const viewerUser = await userService.create(
    {
      username: `viewer_test_${Date.now()}`,
      password: "Test123456",
      realName: "验证用只读用户",
      email: `viewer_test_${Date.now()}@test.com`,
      roleCodes: ["viewer"],
    },
    admin?.id
  );
  check("创建 viewer 用户成功", !!viewerUser?.id);
  if (viewerUser?.id) {
    const viewerTree = await menuService.getTreeByUser(viewerUser.id);
    const flat = JSON.stringify(viewerTree);
    check("viewer 树不含 用户管理(只读)", !flat.includes("menu.menu.adminCenter.userCenter"));
    check("viewer 树不含 菜单管理", !flat.includes("menu.menu.superAdmin.menuCenter"));
    check("viewer 树不含 角色管理", !flat.includes("menu.menu.superAdmin.roleCenter"));
    // 祖先补全：用户管理 的父目录 系统管理 应被纳入
    check("viewer 树祖先补全(含 系统管理)", flat.includes("menu.menu.adminCenter.title"));
    // 清理 viewer 用户
    await userService.delete(viewerUser.id, admin?.id);
    console.log("     已清理 viewer 测试用户");
  }

  // ---------- 4. 菜单 CRUD + 统一规则 ----------
  console.log("\n[4] menuService CRUD");
  const menu = await menuService.create({
    name: "验证菜单",
    type: "MENU",
    path: "/system/verify",
    component: "@/pages/system/verify/index.vue",
    permission: "system:verify:list",
    sort: 99,
  });
  check("创建菜单成功", !!menu?.id);
  if (menu?.id) {
    const updated = await menuService.update(menu.id, { name: "验证菜单-改", sort: 98 });
    check("更新菜单成功", updated?.name === "验证菜单-改");

    // 同级重名应报 MENU_EXIST
    let dupRejected = false;
    try {
      await menuService.create({
        name: "验证菜单-改",
        type: "MENU",
        path: "/system/verify-dup",
        component: "@/pages/system/verify/index.vue",
        permission: "system:verify:dup",
      });
    } catch (e: any) {
      dupRejected = e?.message === "MENU_EXIST";
    }
    check("同级重名被拦截(MENU_EXIST)", dupRejected);

    // path 唯一
    let pathRejected = false;
    try {
      await menuService.create({
        name: "验证路径重复",
        type: "MENU",
        path: "/system/verify",
        component: "@/pages/system/verify/index.vue",
        permission: "system:verify:path",
      });
    } catch (e: any) {
      pathRejected = e?.message === "MENU_PATH_EXIST";
    }
    check("path 重复被拦截(MENU_PATH_EXIST)", pathRejected);

    // 类型联动：MENU 缺 component
    let componentRejected = false;
    try {
      await menuService.create({
        name: "验证缺组件",
        type: "MENU",
        path: "/system/verify-no-component",
        permission: "system:verify:noComponent",
      });
    } catch (e: any) {
      componentRejected = e?.params?.field === "component";
    }
    check("MENU 缺 component 被拦截", componentRejected);

    // 类型联动：BUTTON 缺 permission
    let buttonRejected = false;
    try {
      await menuService.create({
        parentId: menu.id,
        name: "验证缺权限码",
        type: "BUTTON",
      });
    } catch (e: any) {
      buttonRejected = e?.params?.field === "permission";
    }
    check("BUTTON 缺 permission 被拦截", buttonRejected);

    // 有子菜单应拒绝删除
    const child = await menuService.create({
      parentId: menu.id,
      name: "验证子菜单",
      type: "BUTTON",
      permission: "system:verify:btn",
    });
    let childDeleteRejected = false;
    try {
      await menuService.delete(menu.id);
    } catch (e: any) {
      childDeleteRejected = e?.message === "MENU_HAS_CHILDREN";
    }
    check("有子菜单删除被拦截(MENU_HAS_CHILDREN)", childDeleteRejected);
    if (child?.id) await menuService.delete(child.id);
    await menuService.delete(menu.id);

    // 回收站 + 恢复
    const deletedList = await menuService.getDeletedList();
    check(
      "回收站包含已删菜单",
      deletedList.some((m) => m.id === menu.id)
    );
    const restored = await menuService.restore(menu.id);
    check("恢复已删菜单成功", restored?.id === menu.id);
    let restoreAgain = false;
    try {
      await menuService.restore(menu.id);
    } catch (e: any) {
      restoreAgain = e?.message === "MENU_NOT_DELETED";
    }
    check("重复恢复被拦截(MENU_NOT_DELETED)", restoreAgain);

    // 外链菜单：component 必须为空
    let extCompRejected = false;
    try {
      await menuService.create({
        name: "验证外链带组件",
        type: "MENU",
        path: "https://example.com/verify-ext",
        component: "@/pages/system/verify/index.vue",
        permission: "system:verify:ext",
      });
    } catch (e: any) {
      extCompRejected = e?.params?.field === "component";
    }
    check("外链 MENU 带 component 被拦截", extCompRejected);

    // DIR 不允许外链 path
    let dirExtRejected = false;
    try {
      await menuService.create({
        name: "验证外链目录",
        type: "DIR",
        path: "https://example.com/dir",
      });
    } catch (e: any) {
      dirExtRejected = e?.params?.field === "path";
    }
    check("DIR 外链 path 被拦截", dirExtRejected);

    // BUTTON 不允许 path
    let buttonPathRejected = false;
    try {
      await menuService.create({
        parentId: menu.id,
        name: "验证按钮带路径",
        type: "BUTTON",
        path: "/system/verify-btn",
        permission: "system:verify:btnPath",
      });
    } catch (e: any) {
      buttonPathRejected = e?.params?.field === "path";
    }
    check("BUTTON 带 path 被拦截", buttonPathRejected);

    // BUTTON visible 强制 0
    const btn = await menuService.create({
      parentId: menu.id,
      name: "验证按钮可见性",
      type: "BUTTON",
      permission: "system:verify:btnVisible",
      visible: 1,
    });
    check("BUTTON visible 强制为 0", btn?.visible === 0);
    if (btn?.id) await menuService.delete(btn.id);

    // 恢复时 path 已被占用
    const oldMenu = await menuService.create({
      name: "验证恢复路径占用",
      type: "DIR",
      path: "/system/verify-restore",
    });
    await menuService.delete(oldMenu.id);
    const newMenu = await menuService.create({
      name: "验证占用路径",
      type: "DIR",
      path: "/system/verify-restore",
    });
    let restorePathRejected = false;
    try {
      await menuService.restore(oldMenu.id);
    } catch (e: any) {
      restorePathRejected = e?.message === "MENU_PATH_EXIST";
    }
    check("恢复时 path 被占用(MENU_PATH_EXIST)", restorePathRejected);
    await menuService.delete(newMenu.id);

    // 恢复时父节点仍在回收站
    const parentDir = await menuService.create({
      name: "验证回收站父级",
      type: "DIR",
      path: "/system/verify-parent",
    });
    const childMenu = await menuService.create({
      parentId: parentDir.id,
      name: "验证回收站子级",
      type: "MENU",
      path: "/system/verify-parent/child",
      component: "@/pages/system/verify/index.vue",
      permission: "system:verify:child",
    });
    await menuService.delete(childMenu.id);
    await menuService.delete(parentDir.id);
    let parentDeletedRejected = false;
    try {
      await menuService.restore(childMenu.id);
    } catch (e: any) {
      parentDeletedRejected = e?.message === "MENU_PARENT_DELETED";
    }
    check("父级已删除时恢复被拦截(MENU_PARENT_DELETED)", parentDeletedRejected);
    await menuService.restore(parentDir.id);
    await menuService.restore(childMenu.id);
    await menuService.delete(childMenu.id);
    await menuService.delete(parentDir.id);

    await menuService.delete(menu.id);
  }

  // ---------- 5. 角色 CRUD + 菜单绑定 ----------
  console.log("\n[5] roleService 角色闭环");
  const roleCode = `verify_role_${Date.now()}`;
  const role = await roleService.create({ code: roleCode, name: "验证角色", menuIds: [1, 2] });
  check("创建角色成功", !!role?.id);
  if (role?.id) {
    check("创建时绑定菜单生效", role?.menuIds?.length === 2);
    // 编码查重
    let dupRejected = false;
    try {
      await roleService.create({ code: roleCode, name: "重复角色" });
    } catch (e: any) {
      dupRejected = e?.message === "ROLE_CODE_EXIST";
    }
    check("角色编码重复被拦截(ROLE_CODE_EXIST)", dupRejected);
    // 重建绑定
    await roleService.update(role.id, { name: "验证角色-改", menuIds: [3, 4, 5] });
    const afterUpdate = await roleService.getById(role.id);
    check("更新角色+重建绑定生效", afterUpdate?.name === "验证角色-改" && afterUpdate?.menuIds?.length === 3);
    // assignMenus
    await roleService.assignMenus(role.id, [6]);
    const afterAssign = await roleService.getById(role.id);
    check("assignMenus 单独绑定生效", afterAssign?.menuIds?.length === 1 && afterAssign?.menuIds?.[0] === 6);
    // 删除
    await roleService.delete(role.id);
    let delCheck = true;
    try {
      await roleService.getById(role.id);
      delCheck = false;
    } catch (e: any) {
      delCheck = e?.message === "ROLE_NOT_FOUND";
    }
    check("角色删除成功", delCheck);
  }

  // ---------- 5.5 admin 菜单绑定可重建 ----------
  console.log("\n[5.5] admin 菜单绑定可重建");
  const adminRole = (await roleService.getList()).find((r: any) => r.code === "admin");
  if (adminRole) {
    const originalIds: number[] = adminRole.menuIds ?? [];
    let adminUpdateOk = true;
    let adminAssignOk = true;
    let adminPermOk = true;
    try {
      await roleService.update(adminRole.id, { menuIds: originalIds });
    } catch {
      adminUpdateOk = false;
    }
    try {
      await roleService.assignMenus(adminRole.id, originalIds);
    } catch {
      adminAssignOk = false;
    }
    try {
      await roleService.assignPermissions(adminRole.id, adminRole.permissions ?? []);
    } catch {
      adminPermOk = false;
    }
    check("admin update(menuIds) 不被系统保护拦截", adminUpdateOk);
    check("admin assignMenus 不被系统保护拦截", adminAssignOk);
    check("admin assignPermissions 不被系统保护拦截", adminPermOk);
    await roleService.assignMenus(adminRole.id, originalIds);
    const adminAfter = await roleService.getById(adminRole.id);
    check(
      "admin 原菜单绑定已还原",
      adminAfter?.menuIds?.length === originalIds.length && originalIds.every((id) => adminAfter?.menuIds?.includes(id))
    );
  }

  // ---------- 6. 角色被用户引用时拒绝删除 ----------
  console.log("\n[6] 角色占用保护");
  const tmpRole = await roleService.create({ code: `inuse_role_${Date.now()}`, name: "占用验证角色" });
  if (tmpRole?.id) {
    // 把刚创建的临时角色手动绑定给一个用户再删
    const bindUser = await userService.create(
      { username: `bind_${Date.now()}`, password: "Test123456", email: `bind_${Date.now()}@test.com` },
      admin?.id
    );
    if (bindUser?.id) {
      await prisma.userRole.create({ data: { userId: bindUser.id, roleId: tmpRole.id } });
      let rejected = false;
      try {
        await roleService.delete(tmpRole.id);
      } catch (e: any) {
        rejected = e?.message === "ROLE_IN_USE";
      }
      check("被用户引用的角色拒绝删除(ROLE_IN_USE)", rejected);
      await userService.delete(bindUser.id, admin?.id);
    }
    await roleService.delete(tmpRole.id);
    check("解除引用后可删除", true);
  }

  console.log(`\n========== 结果: ${pass} 通过 / ${fail} 失败 ==========`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("验证脚本异常:", e);
  process.exit(1);
});
