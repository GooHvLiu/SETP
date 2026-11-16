/**
 * ============================================================
 * 数据库种子脚本（prisma/seed.ts）
 * ------------------------------------------------------------
 * 职责：初始化 RBAC 基础数据：
 *   1. 四个内置角色：superAdmin（超级管理员，隐藏/受保护）/ admin（管理员）/ operator（操作员）/ viewer（只读）
 *   2. 菜单权限点：29 条业务菜单（与前端 mockMenuData 一致）+ 33 个隐藏权限点
 *      （隐藏权限点：BUTTON + visible=0，仅提供后端接口权限码，不进前端菜单树）
 *   3. 默认管理员账号（.env 的 ADMIN_USERNAME / ADMIN_PASSWORD）+ 超级管理员账号（模板默认值，见 constants/password.ts）
 *   4. 角色-菜单绑定：superAdmin 全量 65（业务 + 隐藏权限点）；admin 业务运营 26；operator/viewer 按角色表格绑定
 *
 * 执行：npm run db:seed
 * 幂等：重复执行不会产生重复数据（按 name + type / username 判重）
 *
 * 菜单数据约定（与前端 mockMenuData / 菜单组契约一致）：
 *   - mockId：脚本内引用键（父级用 parentMockId 指向）；落库 id 由数据库自增
 *   - menu_group：顶层组标识（menu.group.General/Tasks/Settings）；子级统一 ""
 *   - sort：顶层两位（十位=组标识、个位=组内排序）；子级直接按 sort 排
 *   - name：存 i18n key（前端按 key 取文案）；隐藏权限点 name 亦用 i18n key（menu.button.*，不渲染，仅管理端可读）
 * ============================================================
 */

import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import path from "path";
import { runHelpMigrations } from "../src/db/helpMigrations";
// 角色码统一引用 constants/role.ts（唯一权威源，与业务代码共享，避免双源）
import { ROLE } from "../src/constants/role";
import {
  TEMPLATE_ADMIN_USERNAME,
  TEMPLATE_ADMIN_PASSWORD,
  TEMPLATE_SUPER_ADMIN_PASSWORD
} from "../src/constants/password";
import { CONFIG_REGISTRY, getEnvFallback } from "../src/config/config.registry";
import { sealSecret } from "../src/utils/secretBox";

// 加载 .env（seed 脚本独立运行，需要自行加载环境变量）
dotenvExpand.expand(dotenv.config({ path: path.resolve(process.cwd(), ".env") }));

// Prisma 7 新架构：按 DB_TYPE 选择 Driver Adapter 创建客户端
const dbType = (process.env.DB_TYPE || "sqlite") as "mysql" | "sqlite";

// 从连接串解析 MySQL 各字段（seed 独立运行，不依赖 src/config）
function parseMysqlUrl(url: string) {
  const m = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!m) throw new Error(`DATABASE_URL 不是合法的 MySQL 连接串: ${url}`);
  return { user: m[1], password: m[2], host: m[3], port: Number(m[4]), database: m[5] };
}

const adapter =
  dbType === "mysql"
    ? (() => {
        const mysql = parseMysqlUrl(process.env.DATABASE_URL!);
        return new PrismaMariaDb({
          host: mysql.host,
          port: mysql.port,
          user: mysql.user,
          password: mysql.password,
          database: mysql.database,
          connectionLimit: 10
        });
      })()
    : new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/** RBAC：内置角色定义（code 来自 constants/role.ts 的 ROLE 常量） */
const BUILTIN_ROLES = [
  { code: ROLE.ADMIN, name: "role.admin.name", description: "role.admin.description" },
  { code: ROLE.OPERATOR, name: "role.operator.name", description: "role.operator.description" },
  { code: ROLE.VIEWER, name: "role.viewer.name", description: "role.viewer.description" },
  { code: ROLE.SUPER_ADMIN, name: "role.superAdmin.name", description: "role.superAdmin.description" }
] as const;

/** RBAC：内置菜单权限点（扁平数组，mockId 引用父级） */
// mockId：脚本内引用键（父级用 parentMockId 指向，顺序创建父先子后）
// menu_group：菜单分组标识（DIR/MENU 顶层用组名；子级统一 ""）
// 隐藏权限点（type=BUTTON visible=0）：仅提供后端接口权限码，不进前端菜单树
interface BuiltinMenu {
  mockId: number;
  parentMockId: number;
  name: string;
  type: string;
  path: string;
  component: string;
  icon: string;
  menu_group: string;
  permission: string;
  sort: number;
  visible: number;
}

const BUILTIN_MENUS: BuiltinMenu[] = [
  // ===== General 组 dashBoard + dataSearch =====
  {
    mockId: 1,
    parentMockId: 0,
    name: "menu.menu.dashBoard",
    type: "MENU",
    path: "/dashboard",
    component: "@/pages/dashboard/index.vue",
    icon: "FullScreen",
    menu_group: "menu.group.General",
    permission: "dashBoard:list",
    sort: 11,
    visible: 1
  },
  {
    mockId: 2,
    parentMockId: 0,
    name: "menu.menu.dataSearch",
    type: "MENU",
    path: "/data-search",
    component: "@/pages/data-search/index.vue",
    icon: "DataLine",
    menu_group: "menu.group.General",
    permission: "dataSearch:list",
    sort: 12,
    visible: 1
  },
  // ===== Tasks 组 designTasks（cuttingMachine/testMachine）+ projects（tickets/orders） =====
  {
    mockId: 3,
    parentMockId: 0,
    name: "menu.menu.designTasks.title",
    type: "DIR",
    path: "/design-tasks",
    component: "@/pages/design-tasks/index.vue",
    icon: "Postcard",
    menu_group: "menu.group.Tasks",
    permission: "designTasks:list",
    sort: 21,
    visible: 1
  },
  {
    mockId: 31,
    parentMockId: 3,
    name: "menu.menu.designTasks.cuttingMachine",
    type: "MENU",
    path: "/design-tasks/cutting-machine",
    component: "@/pages/design-tasks/cutting-machine/index.vue",
    icon: "",
    menu_group: "",
    permission: "designTasks:cuttingMachine:list",
    sort: 1,
    visible: 1
  },
  {
    mockId: 32,
    parentMockId: 3,
    name: "menu.menu.designTasks.testMachine",
    type: "MENU",
    path: "/design-tasks/test-machine",
    component: "@/pages/design-tasks/test-machine/index.vue",
    icon: "",
    menu_group: "",
    permission: "designTasks:testMachine:list",
    sort: 2,
    visible: 1
  },
  {
    mockId: 4,
    parentMockId: 0,
    name: "menu.menu.projects.title",
    type: "DIR",
    path: "/projects",
    component: "@/pages/projects/index.vue",
    icon: "Tickets",
    menu_group: "menu.group.Tasks",
    permission: "projects:list",
    sort: 22,
    visible: 1
  },
  {
    mockId: 41,
    parentMockId: 4,
    name: "menu.menu.projects.tickets",
    type: "MENU",
    path: "/projects/tickets",
    component: "@/pages/projects/tickets/index.vue",
    icon: "",
    menu_group: "",
    permission: "projects:tickets:list",
    sort: 1,
    visible: 1
  },
  {
    mockId: 42,
    parentMockId: 4,
    name: "menu.menu.projects.orders",
    type: "MENU",
    path: "/projects/orders",
    component: "@/pages/projects/orders/index.vue",
    icon: "",
    menu_group: "",
    permission: "projects:orders:list",
    sort: 2,
    visible: 1
  },
  // ===== Settings 组 systemSettings =====
  {
    mockId: 5,
    parentMockId: 0,
    name: "menu.menu.systemSettings",
    type: "MENU",
    path: "/system-settings",
    component: "@/pages/system-settings/index.vue",
    icon: "Setting",
    menu_group: "menu.group.Settings",
    permission: "systemSettings:list",
    sort: 31,
    visible: 1
  },
  {
    mockId: 2015,
    parentMockId: 5,
    name: "menu.button.config.list",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "systemSettings:config:list",
    sort: 1,
    visible: 0
  },
  {
    mockId: 2016,
    parentMockId: 5,
    name: "menu.button.config.update",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "systemSettings:config:update",
    sort: 2,
    visible: 0
  },
  // ===== Settings 组 adminCenter（userCenter + logsCenter + noticeCenter） =====
  {
    mockId: 6,
    parentMockId: 0,
    name: "menu.menu.adminCenter.title",
    type: "DIR",
    path: "/admin-center",
    component: "@/pages/admin-center/index.vue",
    icon: "Aim",
    menu_group: "menu.group.Settings",
    permission: "adminCenter:list",
    sort: 32,
    visible: 1
  },
  {
    mockId: 62,
    parentMockId: 6,
    name: "menu.menu.adminCenter.userCenter",
    type: "MENU",
    path: "/admin-center/user-center",
    component: "@/pages/admin-center/user-center/index.vue",
    icon: "",
    menu_group: "",
    permission: "adminCenter:userCenter:list",
    sort: 1,
    visible: 1
  },
  {
    mockId: 2001,
    parentMockId: 62,
    name: "menu.button.user.list",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "adminCenter:user:list",
    sort: 1,
    visible: 0
  },
  {
    mockId: 2002,
    parentMockId: 62,
    name: "menu.button.user.create",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "adminCenter:user:create",
    sort: 2,
    visible: 0
  },
  {
    mockId: 2003,
    parentMockId: 62,
    name: "menu.button.user.update",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "adminCenter:user:update",
    sort: 3,
    visible: 0
  },
  {
    mockId: 2004,
    parentMockId: 62,
    name: "menu.button.user.delete",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "adminCenter:user:delete",
    sort: 4,
    visible: 0
  },
  {
    mockId: 65,
    parentMockId: 6,
    name: "menu.menu.adminCenter.logsCenter",
    type: "MENU",
    path: "/admin-center/logs-center",
    component: "@/pages/admin-center/logs-center/index.vue",
    icon: "",
    menu_group: "",
    permission: "adminCenter:logsCenter:list",
    sort: 2,
    visible: 1
  },
  {
    mockId: 2017,
    parentMockId: 65,
    name: "menu.button.log.list",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "adminCenter:log:list",
    sort: 1,
    visible: 0
  },
  {
    mockId: 66,
    parentMockId: 6,
    name: "menu.menu.adminCenter.noticeCenter",
    type: "MENU",
    path: "/admin-center/notice-center",
    component: "@/pages/admin-center/notice-center/index.vue",
    icon: "",
    menu_group: "",
    permission: "adminCenter:noticeCenter:list",
    sort: 3,
    visible: 1
  },
  // ===== Settings 组 about（githubPage + appDown + credits + help） =====
  {
    mockId: 7,
    parentMockId: 0,
    name: "menu.menu.about.title",
    type: "DIR",
    path: "/about",
    component: "@/pages/about/index.vue",
    icon: "Warning",
    menu_group: "menu.group.Settings",
    permission: "about:list",
    sort: 33,
    visible: 1
  },
  {
    mockId: 71,
    parentMockId: 7,
    name: "menu.menu.about.githubPage",
    type: "MENU",
    path: "https://github.com/goohv",
    component: "",
    icon: "",
    menu_group: "",
    permission: "about:githubPage:list",
    sort: 1,
    visible: 1
  },
  {
    mockId: 72,
    parentMockId: 7,
    name: "menu.menu.about.appDown",
    type: "MENU",
    path: "/about/app-down",
    component: "@/pages/about/app-down/index.vue",
    icon: "",
    menu_group: "",
    permission: "about:appDown:list",
    sort: 2,
    visible: 1
  },
  {
    mockId: 73,
    parentMockId: 7,
    name: "menu.menu.about.credits",
    type: "MENU",
    path: "/about/credits",
    component: "@/pages/about/credits/index.vue",
    icon: "",
    menu_group: "",
    permission: "about:credits:list",
    sort: 3,
    visible: 1
  },
  {
    mockId: 74,
    parentMockId: 7,
    name: "menu.menu.about.help",
    type: "MENU",
    path: "/about/help",
    component: "@/pages/about/help/index.vue",
    icon: "",
    menu_group: "",
    permission: "about:help:list",
    sort: 4,
    visible: 1
  },
  // ===== superAdmin 组「超级面板」：超级设置（独立页，复用系统参数接口） =====
  {
    mockId: 86,
    parentMockId: 0,
    name: "menu.menu.superSettings",
    type: "MENU",
    path: "/super-settings",
    component: "@/pages/super-settings/index.vue",
    icon: "Crop",
    menu_group: "menu.group.superAdmin",
    permission: "superAdmin:settings:list",
    sort: 41,
    visible: 1
  },
  // ===== superAdmin 组「超级面板」：超级管理（九个业务页的父容器） =====
  {
    mockId: 87,
    parentMockId: 0,
    name: "menu.menu.superAdmin.title",
    type: "DIR",
    path: "/super-admin",
    component: "@/pages/super-admin/index.vue",
    icon: "Odometer",
    menu_group: "menu.group.superAdmin",
    permission: "superAdmin:center:list",
    sort: 42,
    visible: 1
  },
  // ===== superAdmin 组「超级面板」：健康检查 =====
  {
    mockId: 83,
    parentMockId: 87,
    name: "menu.menu.superAdmin.healthCheck",
    type: "MENU",
    path: "/super-admin/health-check",
    component: "@/pages/super-admin/health-check/index.vue",
    icon: "",
    menu_group: "",
    permission: "superAdmin:healthCheck:list",
    sort: 1,
    visible: 1
  },
  {
    mockId: 2023,
    parentMockId: 83,
    name: "menu.button.health.list",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:health:list",
    sort: 1,
    visible: 0
  },
  {
    mockId: 2024,
    parentMockId: 83,
    name: "menu.button.health.probe",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:health:probe",
    sort: 2,
    visible: 0
  },
  // ===== superAdmin 组「超级面板」：会话中心 =====
  {
    mockId: 81,
    parentMockId: 87,
    name: "menu.menu.superAdmin.sessionCenter",
    type: "MENU",
    path: "/super-admin/session-center",
    component: "@/pages/super-admin/session-center/index.vue",
    icon: "",
    menu_group: "",
    permission: "superAdmin:sessionCenter:list",
    sort: 2,
    visible: 1
  },
  {
    mockId: 2018,
    parentMockId: 81,
    name: "menu.button.session.list",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:session:list",
    sort: 1,
    visible: 0
  },
  {
    mockId: 2019,
    parentMockId: 81,
    name: "menu.button.session.revoke",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:session:revoke",
    sort: 2,
    visible: 0
  },
  {
    mockId: 2020,
    parentMockId: 81,
    name: "menu.button.session.cleanup",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:session:cleanup",
    sort: 3,
    visible: 0
  },
  // ===== superAdmin 组「超级面板」：运行面板 =====
  {
    mockId: 84,
    parentMockId: 87,
    name: "menu.menu.superAdmin.metricsCenter",
    type: "MENU",
    path: "/super-admin/metrics-center",
    component: "@/pages/super-admin/metrics-center/index.vue",
    icon: "",
    menu_group: "",
    permission: "superAdmin:metricsCenter:list",
    sort: 3,
    visible: 1
  },
  {
    mockId: 2026,
    parentMockId: 84,
    name: "menu.button.metrics.reset",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:metrics:reset",
    sort: 2,
    visible: 0
  },
  // ===== superAdmin 组「超级面板」：运维任务 =====
  {
    mockId: 85,
    parentMockId: 87,
    name: "menu.menu.superAdmin.taskCenter",
    type: "MENU",
    path: "/super-admin/task-center",
    component: "@/pages/super-admin/task-center/index.vue",
    icon: "",
    menu_group: "",
    permission: "superAdmin:taskCenter:list",
    sort: 4,
    visible: 1
  },
  {
    mockId: 2028,
    parentMockId: 85,
    name: "menu.button.task.run",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:task:run",
    sort: 2,
    visible: 0
  },
  {
    mockId: 2029,
    parentMockId: 85,
    name: "menu.button.task.danger",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:task:danger",
    sort: 3,
    visible: 0
  },
  // ===== superAdmin 组「超级面板」：字典中心 =====
  {
    mockId: 61,
    parentMockId: 87,
    name: "menu.menu.superAdmin.dictCenter.title",
    type: "MENU",
    path: "/super-admin/dict-center",
    component: "@/pages/super-admin/dict-center/dict-type/index.vue",
    icon: "",
    menu_group: "",
    permission: "superAdmin:dictCenter:list",
    sort: 5,
    visible: 1
  },
  {
    mockId: 2014,
    parentMockId: 61,
    name: "menu.button.dict.update",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:dict:update",
    sort: 1,
    visible: 0
  },
  // ===== superAdmin 组「超级面板」：角色中心 =====
  {
    mockId: 63,
    parentMockId: 87,
    name: "menu.menu.superAdmin.roleCenter",
    type: "MENU",
    path: "/super-admin/role-center",
    component: "@/pages/super-admin/role-center/index.vue",
    icon: "",
    menu_group: "",
    permission: "superAdmin:roleCenter:list",
    sort: 6,
    visible: 1
  },
  {
    mockId: 2005,
    parentMockId: 63,
    name: "menu.button.role.list",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:role:list",
    sort: 1,
    visible: 0
  },
  {
    mockId: 2006,
    parentMockId: 63,
    name: "menu.button.role.create",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:role:create",
    sort: 2,
    visible: 0
  },
  {
    mockId: 2007,
    parentMockId: 63,
    name: "menu.button.role.update",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:role:update",
    sort: 3,
    visible: 0
  },
  {
    mockId: 2008,
    parentMockId: 63,
    name: "menu.button.role.delete",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:role:delete",
    sort: 4,
    visible: 0
  },
  // ===== superAdmin 组「超级面板」：菜单中心 =====
  {
    mockId: 67,
    parentMockId: 87,
    name: "menu.menu.superAdmin.menuCenter",
    type: "MENU",
    path: "/super-admin/menu-center",
    component: "@/pages/super-admin/menu-center/index.vue",
    icon: "",
    menu_group: "",
    permission: "superAdmin:menuCenter:list",
    sort: 7,
    visible: 1
  },
  {
    mockId: 2010,
    parentMockId: 67,
    name: "menu.button.menu.list",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:menu:list",
    sort: 1,
    visible: 0
  },
  {
    mockId: 2011,
    parentMockId: 67,
    name: "menu.button.menu.create",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:menu:create",
    sort: 2,
    visible: 0
  },
  {
    mockId: 2012,
    parentMockId: 67,
    name: "menu.button.menu.update",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:menu:update",
    sort: 3,
    visible: 0
  },
  {
    mockId: 2013,
    parentMockId: 67,
    name: "menu.button.menu.delete",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:menu:delete",
    sort: 4,
    visible: 0
  },
  {
    mockId: 2030,
    parentMockId: 67,
    name: "menu.button.menu.restore",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:menu:restore",
    sort: 5,
    visible: 0
  },
  // ===== superAdmin 组「超级面板」：知识运维 =====
  {
    mockId: 82,
    parentMockId: 87,
    name: "menu.menu.superAdmin.knowledgeCenter",
    type: "MENU",
    path: "/super-admin/knowledge-center",
    component: "@/pages/super-admin/knowledge-center/index.vue",
    icon: "",
    menu_group: "",
    permission: "superAdmin:knowledgeCenter:list",
    sort: 8,
    visible: 1
  },
  {
    mockId: 2021,
    parentMockId: 82,
    name: "menu.button.help.list",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:help:list",
    sort: 1,
    visible: 0
  },
  {
    mockId: 2022,
    parentMockId: 82,
    name: "menu.button.help.reindex",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:help:reindex",
    sort: 2,
    visible: 0
  },
  {
    mockId: 2032,
    parentMockId: 82,
    name: "menu.button.help.docCreate",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:help:doc:create",
    sort: 3,
    visible: 0
  },
  {
    mockId: 2033,
    parentMockId: 82,
    name: "menu.button.help.docUpdate",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:help:doc:update",
    sort: 4,
    visible: 0
  },
  {
    mockId: 2034,
    parentMockId: 82,
    name: "menu.button.help.docDelete",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:help:doc:delete",
    sort: 5,
    visible: 0
  },
  {
    mockId: 2035,
    parentMockId: 82,
    name: "menu.button.help.slotManage",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:help:slot:manage",
    sort: 6,
    visible: 0
  },
  // ===== superAdmin 组「超级面板」：权限中心 =====
  {
    mockId: 64,
    parentMockId: 87,
    name: "menu.menu.superAdmin.permissionCenter",
    type: "MENU",
    path: "/super-admin/permission-center",
    component: "@/pages/super-admin/permission-center/index.vue",
    icon: "",
    menu_group: "",
    permission: "superAdmin:permissionCenter:list",
    sort: 9,
    visible: 1
  },
  {
    mockId: 2009,
    parentMockId: 64,
    name: "menu.button.permission.assign",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:role:assign",
    sort: 1,
    visible: 0
  },
  // 超级设置页的写权限（页面本身是 86，读权限在菜单上）
  {
    mockId: 2031,
    parentMockId: 86,
    name: "menu.button.superSettings.update",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "superAdmin:settings:update",
    sort: 1,
    visible: 0
  },
  // 通知中心：管理员发送 + 批次管理
  {
    mockId: 2036,
    parentMockId: 66,
    name: "menu.button.notice.send",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "adminCenter:notice:send",
    sort: 1,
    visible: 0
  },
  {
    mockId: 2037,
    parentMockId: 66,
    name: "menu.button.notice.manage",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "adminCenter:notice:manage",
    sort: 2,
    visible: 0
  },
  // 日志中心：超管手动清理
  {
    mockId: 2038,
    parentMockId: 65,
    name: "menu.button.log.cleanup",
    type: "BUTTON",
    path: "",
    component: "",
    icon: "",
    menu_group: "",
    permission: "adminCenter:log:cleanup",
    sort: 2,
    visible: 0
  }
];

/** 业务菜单 mockId 全量（29 条，顺序与 BUILTIN_MENUS 定义一致） */
const BIZ_MOCK_IDS = [
  1, 2, 3, 31, 32, 4, 41, 42, 5, 6, 62, 65, 66, 7, 71, 72, 73, 74, 86, 87, 83, 81, 84, 85, 61, 63, 67, 82, 64
];
/** 已下线权限码：仅用于 seed 时物理清除历史库遗留节点，不参与任何绑定 */
const RETIRED_PERMISSIONS = ["superAdmin:metrics:list", "superAdmin:task:list"];

/** 隐藏权限点 mockId 全量（36 个，2001-2038 中剔除已下线的 2025 / 2027） */
const HIDDEN_MOCK_IDS = Array.from({ length: 38 }, (_, i) => 2001 + i).filter((id) => id !== 2025 && id !== 2027);

/** 角色-菜单绑定（mockId 引用；superAdmin 全量，admin 业务运营 28，operator/viewer 按角色表格） */
const ROLE_MENU_BINDINGS: Record<string, number[]> = {
  // admin：业务运营（28 项，含角色列表只读、通知发送/批次管理；不含字典/角色写/权限/菜单中心及其按钮）
  admin: [
    1, 2, 3, 31, 32, 4, 41, 42, 2005, 5, 2015, 2016, 6, 62, 2001, 2002, 2003, 2004, 65, 2017, 66, 2036, 2037, 7, 71, 72,
    73, 74
  ],
  operator: [1, 2, 3, 31, 32, 4, 41, 42, 5, 66, 7, 71, 72, 73, 74],
  viewer: [1, 2, 3, 31, 32, 4, 41, 42, 66, 7, 71, 72, 73, 74],
  // superAdmin：全量 65（业务 + 隐藏权限点），仅设计者维护
  superAdmin: [...BIZ_MOCK_IDS, ...HIDDEN_MOCK_IDS]
};

/** 主流程：幂等初始化 */
async function main(): Promise<void> {
  runHelpMigrations();
  // ---------- 1. 初始化角色 ----------
  const roleMap = new Map<string, number>();
  for (const r of BUILTIN_ROLES) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description },
      create: { code: r.code, name: r.name, description: r.description }
    });
    roleMap.set(r.code, role.id);
  }
  console.log("✅ 角色初始化完成");

  // ---------- 2. 初始化菜单权限点（按 mockId 建立父子关系，顺序创建父先子后） ----------
  // 查重键：name + type（存在时更新全部可配置字段，保证数据可校正）
  const menuIdMap = new Map<number, number>();
  for (const m of BUILTIN_MENUS) {
    const parentId = m.parentMockId ? (menuIdMap.get(m.parentMockId) ?? 0) : 0;

    const exist = await prisma.menu.findFirst({
      where: { name: m.name, type: m.type }
    });
    const data = {
      parentId,
      path: m.path,
      component: m.component,
      icon: m.icon,
      // Prisma model 字段名 group（DB 列名 menu_group，@map 映射）
      group: m.menu_group,
      permission: m.permission,
      sort: m.sort,
      visible: m.visible
    };
    const created = exist
      ? await prisma.menu.update({ where: { id: exist.id }, data })
      : await prisma.menu.create({ data: { ...data, name: m.name, type: m.type } });
    menuIdMap.set(m.mockId, created.id);
  }
  console.log(`✅ 菜单权限初始化完成（${BUILTIN_MENUS.length} 项）`);

  // 清理已下线权限码：物理删除历史库中遗留的节点与其角色绑定（幂等，无残留时跳过）
  for (const permission of RETIRED_PERMISSIONS) {
    const stale = await prisma.menu.findMany({ where: { permission }, select: { id: true } });
    if (!stale.length) continue;
    const staleIds = stale.map((m) => m.id);
    await prisma.roleMenu.deleteMany({ where: { menuId: { in: staleIds } } });
    await prisma.menu.deleteMany({ where: { id: { in: staleIds } } });
  }

  // ---------- 3. 角色-菜单绑定 ----------
  const uniq = (ids: (number | undefined)[]) => Array.from(new Set(ids.filter((x): x is number => !!x)));

  const bindings: Record<string, number[]> = {};
  for (const [roleCode, mockIds] of Object.entries(ROLE_MENU_BINDINGS)) {
    bindings[roleCode] = uniq(mockIds.map((id) => menuIdMap.get(id)));
  }

  for (const [roleCode, menuIds] of Object.entries(bindings)) {
    const roleId = roleMap.get(roleCode);
    if (!roleId) continue;
    // 只补缺失的基础菜单，不删除已有绑定，避免覆盖使用方给内置角色追加的授权
    const existing = await prisma.roleMenu.findMany({ where: { roleId }, select: { menuId: true } });
    const existingIds = new Set(existing.map((row) => row.menuId));
    const missing = menuIds.filter((menuId) => !existingIds.has(menuId));
    if (missing.length > 0) {
      await prisma.roleMenu.createMany({ data: missing.map((menuId) => ({ roleId, menuId })) });
    }
  }
  console.log("✅ 角色-菜单绑定完成");

  // ---------- 3.5 系统参数：按注册表写入双域元数据 ----------
  // 注册表是唯一权威源：scope/group/readScope/type/validation/env 兜底都在 config.registry.ts
  // 幂等：已存在的键只同步元数据，不覆盖用户已保存的 config_value
  // .env 在 import 之后才加载；注册表里的 process.env.MAIL_INIT_* 可能在模块求值时为空，
  // 因此这里在 seed 函数体内再读一次，确保授权码等初始化值真正写库。
  const mailInitSeed: Record<string, string | undefined> = {
    mail_smtp_user: process.env.MAIL_INIT_USER,
    mail_smtp_pass: process.env.MAIL_INIT_PASS,
    mail_from: process.env.MAIL_INIT_FROM || process.env.MAIL_INIT_USER,
    mail_test_readback_timeout_ms: "60000"
  };

  for (const def of CONFIG_REGISTRY) {
    // 系统域可写；超级设置域中对系统设置公开只读的项，库里 editable=0；
    // 超级设置接口本身按权限放行，不依赖该列。
    const editable = def.scope === "system" || def.readScope === "super" ? 1 : 0;
    // seedValue 显式给 null 时落空值；否则有 env 兜底的键留空让 env 生效
    // 所有带 envKey 的参数在 seed 时固化：seed 后运行期只读数据库
    const explicitSeed = mailInitSeed[def.key] !== undefined ? mailInitSeed[def.key] : def.seedValue;
    const configValue =
      explicitSeed !== undefined
        ? explicitSeed
        : def.envKey
          ? (getEnvFallback(def) ?? def.defaultValue)
          : def.defaultValue;
    // 敏感项入库前加密；本地无密钥时保持明文，生产环境缺少密钥会直接抛错
    const storedValue = def.sensitive && configValue ? sealSecret(configValue) : configValue;
    await prisma.systemConfig.upsert({
      where: { configKey: def.key },
      update: {
        description: `config.${def.key}.description`,
        editable,
        configScope: def.scope,
        configGroup: def.group,
        readScope: def.readScope,
        valueType: def.type,
        defaultValue: def.defaultValue,
        validationJson: JSON.stringify(def.validation),
        envKey: def.envKey || "",
        restartRequired: def.restartRequired || 0,
        sort: def.sort || 0,
        status: 1
      },
      create: {
        configKey: def.key,
        configValue: storedValue,
        description: `config.${def.key}.description`,
        editable,
        configScope: def.scope,
        configGroup: def.group,
        readScope: def.readScope,
        valueType: def.type,
        defaultValue: def.defaultValue,
        validationJson: JSON.stringify(def.validation),
        envKey: def.envKey || "",
        restartRequired: def.restartRequired || 0,
        sort: def.sort || 0,
        status: 1
      }
    });
    // 已有库里 NULL 或空串的参数补一次 seed 值；已有非空值不动
    if (configValue !== null) {
      await prisma.systemConfig.updateMany({
        where: {
          configKey: def.key,
          OR: [{ configValue: null }, { configValue: "" }]
        },
        data: { configValue }
      });
    }
  }
  console.log(`✅ 系统参数初始化完成: ${CONFIG_REGISTRY.length} 项`);

  // ---------- 4. 默认管理员账号 ----------
  const username = process.env.ADMIN_USERNAME || TEMPLATE_ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD || TEMPLATE_ADMIN_PASSWORD;

  const hashedPassword = await bcrypt.hash(password, 10);
  const adminRoleId = roleMap.get("admin");

  // 用户不存在则创建并绑定 admin 角色；已存在只同步启用状态，不覆盖用户自己维护的资料
  const adminUser = await prisma.user.upsert({
    where: { username },
    update: { status: 1 },
    create: {
      username,
      email: process.env.ADMIN_EMAIL || `${username}@example.com`,
      passwordHash: hashedPassword,
      realName: "Administrator",
      status: 1
    }
  });

  // 绑定 admin 角色（幂等：先删后建）
  if (adminRoleId) {
    await prisma.userRole.deleteMany({ where: { userId: adminUser.id } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRoleId } });
  }

  console.log(`✅ 默认管理员初始化完成: ${username}`);
  // ---------- 4.5 超级管理员账号（隐藏账号；模板默认口令，正式项目必须替换） ----------
  // 用户名：superAdmin（保留名，注册/创建禁用）；默认口令见 constants/password.ts
  // 资料只在首次创建时写入，后续启动/重跑 seed 不覆盖
  const superAdminUsername = "superAdmin";
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || TEMPLATE_SUPER_ADMIN_PASSWORD;
  const superAdminHashed = await bcrypt.hash(superAdminPassword, 10);
  const superAdminRoleId = roleMap.get(ROLE.SUPER_ADMIN);
  const superAdminUser = await prisma.user.upsert({
    where: { username: superAdminUsername },
    update: { status: 1, isSuper: 1 },
    create: {
      username: superAdminUsername,
      email: process.env.SUPER_ADMIN_EMAIL || "super@example.com",
      passwordHash: superAdminHashed,
      realName: process.env.SUPER_ADMIN_REAL_NAME || "superAdmin",
      status: 1,
      isSuper: 1
    }
  });
  if (superAdminRoleId) {
    await prisma.userRole.deleteMany({ where: { userId: superAdminUser.id } });
    await prisma.userRole.create({ data: { userId: superAdminUser.id, roleId: superAdminRoleId } });
  }
  console.log("✅ 超级管理员初始化完成: superAdmin（隐藏账号，仅设计者维护）");
}

main()
  .catch((e) => {
    console.error("❌ 种子脚本执行失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    // MySQL 适配器的连接池在部分平台不会随 disconnect 立即释放，
    // 这里限时等待后强制退出，避免 db:prepare / npm start 停在种子阶段。
    await Promise.race([prisma.$disconnect().catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 2000))]);
    process.exit(0);
  });
