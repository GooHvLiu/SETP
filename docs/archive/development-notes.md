# express-prisma-tsoa

> Express + TypeScript + Prisma + TSOA 后端框架模板，开箱即用的完整工程化模板。

> 状态：历史资料，不再维护。当前行为以 [`README.md`](../../README.md)、代码和 [`docs/api`](../api) 为准。

## 技术规格

### 技术选用

| 分类      | 技术                            | 说明                                                                          |
| --------- | ------------------------------- | ----------------------------------------------------------------------------- |
| 核心框架  | `Express 4`                     | Node.js Web 框架，中间件模型，MVC 分层                                        |
| 开发语言  | `TypeScript`                    | 全量 TS，`tsc` 类型检查，`tsx` 直接运行 + `nodemon` 热重载                    |
| 路由/文档 | `TSOA`                          | 装饰器即路由 + 自动生成 OpenAPI 3.0 文档                                      |
| 数据库    | `Prisma`                        | schema 单文件定义模型 + migrate 迁移 + 强类型 Client；mysql / sqlite 二态切换 |
| 参数校验  | `Joi`                           | controller 层 schema 校验，非法参数直接拦截                                   |
| 认证鉴权  | `JWT 双令牌` + `bcryptjs`       | Access(15m) + Refresh(7d)，刷新/登出吊销；验证码登录                          |
| 权限系统  | `RBAC`                          | 用户-角色-菜单/权限点-按钮 五表模型，权限码中间件                             |
| 日志      | `Pino`                          | 结构化 JSON 日志 + 请求 ID，开发环境 pino-pretty 美化                         |
| 配置      | `dotenv` + `zod`                | 启动即校验环境变量，强类型导出，拼错变量 fail-fast                            |
| 安全      | `helmet` + `express-rate-limit` | 安全响应头；全局 + 登录接口分级限流；账号失败锁定；CORS 白名单                |
| 数据字典  | 自研模块                        | dict_type + dict_data 表 + 内存缓存 + 查询/维护接口                           |
| 菜单角色  | `Menu`+`role`+`user`            | 创建默认菜单，并具备权鉴功能支持                                              |
| API 版本  | `/api/v1`                       | 统一版本前缀，预留 v2 演进                                                    |

- **目录别名**：`@routes` → `routes`、`@src` → `src`（见 `package.json` 的 `_moduleAliases`）
- **路由加载**：`/api/v1` 开头请求由 `tsoa` 编译时自动生成路由，`controller`类+装饰器风格，新增模块只需写 `controller`
- **环境变量**：`.env` 区分应用、数据库、JWT、上传配置，按 `.env.example` 复制，分工如下：

| 文件           | 作用                                                 | 是否提交 git              | 谁用                                       |
| -------------- | ---------------------------------------------------- | ------------------------- | ------------------------------------------ |
| `.env.example` | **模板**，列出所有可用变量和示例值                   | ✅ 提交                   | 新成员 `clone` 后复制改名用                |
| `.env`         | **实际运行配置**，`npm run init` 自动补齐 `LOCAL_IP` | ❌ 不提交（各人本地不同） | 本地开发 / 部署，填写真实数据库、JWT、端口 |

> - 运行时读取 `.env` 中全部变量；数据库密码、JWT 密钥等敏感项务必只写在本机 `.env`，不要提交。
> - `.env.example` 是给人看的说明书，不参与运行；复制它改名为 `.env` 后才生效。
> - `DB_TYPE` 只在本地 `.env` 里按需配置（`mysql` / `sqlite` ）；`NODE_ENV=production` 时 API 文档自动关闭，生产文件里不要开。

### 技术纪要

#### 项目名称

实际使用时，需要将 `package.json` 内的 `name` 更改为实际的名称，同时将 `tsoa.json` 内的 `spec.info.title` 更改为实际的 API 文档标题（即 `/api-docs` 页面显示的标题），建议修改。

#### 数据模式

数据库支持2种模式，通过 `.env` 中的 `DB_TYPE` 切换，此点需要关注，需要注意：

1. `DB_TYPE=mysql`：使用 `mysql2` 连接池，需要先在 MySQL 中建库并导入 `sql/` 下的建表 `SQL`，适合正式环境。
2. `DB_TYPE=sqlite`：使用 `better-sqlite3` 文件库（默认 `data/` 目录下），无需安装数据库服务，首次启动自动生成数据库文件，适合本地开发与单机部署。

> 生产环境必须使用 `DB_TYPE=mysql`；

#### 前缀跨域

后端所有模块路由统一挂载在 `/api/v1/{模块名}` 前缀下（tsoa 编译时自动生成路由，新增模块只需写 controller），需要注意：

1. 开发环境：前端请求 `/api` 相对路径，由前端 `Vite proxy` 转发到后端；后端本身已开启 `CORS`，前端直连完整地址也可访问。
2. 生产环境：没有 `proxy`。推荐在 `Nginx` 里把 `/api` 反向代理到后端端口（和开发环境 `proxy` 效果一样），这样前端生产环境也能填 `/api` 相对路径；或者后端开 `CORS`，前端直接填后端完整地址。
3. 如果以后要接第二个服务（比如 `/upload` 转发到另一个服务），在 `Nginx` 里单独加一条 `/upload` 反代规则即可，后端无需改代码。

#### 环境变量

实际开发时，需要根据实际需求，将 `.env` 环境变量进行实际的修改（数据库账号、JWT 密钥、监听端口、上传目录等）；`.env.example` 是说明书，复制为 `.env` 后才生效，`LOCAL_IP` 由 `npm run init` 自动检测写入。

#### 生产环境

当开发完成后，需要进入生产环境，以下几点即可执行：

- `.env` 切换为生产配置：

  ```env
  # 生产环境配置（NODE_ENV=production）
  NODE_ENV=production
  APP_PORT=3000
  APP_HOST=0.0.0.0
  ......
  ```

- API 文档自动关闭：`NODE_ENV=production` 时 `/api-docs` 不再挂载，无需手动处理

#### 运行命令

以下`package.json`的运行命令需要关注，按需执行：

```json
// 【路由生成】从 TSOA 装饰器生成 Swagger + routes.ts（dev/start 依赖）
"tsoa": "tsoa spec-and-routes",
//【局域网 IP】探测并写入 .env（仅影响启动横幅的 WLAN 地址显示）
"init": "tsx ./src/middleware/dotenvInit.middleware.ts",
//2【数据库】基础命令，从 generate 到 rebuild 按依赖顺序执行
//2a生成 Prisma Client：安装依赖后、修改 schema.prisma 后必须跑一次，否则 @prisma/client 类型与驱动不生效
"db:generate": "prisma generate",
//2b应用迁移建表/改表：空库首次建 13 张表、服务器部署、升级表结构都靠它；不生成新迁移，只执行 migrations 目录里已有的 SQL
"db:deploy": "prisma migrate deploy",
//2c灌种子数据：创建 admin/123456、菜单、角色、权限、演示数据；删库重建后必须跑，否则登录不了、权限全空
"db:seed": "tsx prisma/seed.ts",
//2d一键重装数据库（危险！会清空全部数据）：①删 data/app.db → ②generate 重新生成 Prisma Client → ③migrate deploy 重建 12 张表 → ④seed 灌基础数据；全新克隆/首次初始化用它一步就绪；执行前务必先停服务（Ctrl+C）并确认不需要旧数据
"db:rebuild": "node scripts/rebuild-db.cjs && npm run db:generate && npm run db:deploy && npm run db:seed",
//3【启动与测试】
"predev": "npm run db:generate",
"prestart": "npm run db:generate",
"dev": "npm run tsoa && npm run init && nodemon --exec tsx app.ts",
"start": "npm run tsoa && tsx app.ts",
"test": "node test/api-full-test.cjs"
```

### 二态切换

#### 环境变量

`Prisma 7 Driver Adapters` 架构下，实现数据库二态切换的方式如下：

```ini
# .env sqlite模式
DB_TYPE=sqlite              # 开发默认，零配置
DATABASE_URL="file:./data/app.db"

# 切 MySQL 生成
DB_TYPE=mysql
DATABASE_URL="mysql://root:password@127.0.0.1:3306/db_name"
```

#### 运行操作

接下来执行如下命令：

```bash
# 1. 修改 prisma/schema.prisma 的 provider 为 "mysql"（datasource 块）

# 2. 重新生成 Client（provider 变了必须重新生成）
	npx prisma generate
# 3. 执行迁移（生产环境用 deploy，不动开发库）
	npx prisma migrate deploy
# 4. 灌种子数据
	npm run db:seed
```

> 运行时连接由 Driver Adapter 提供（`src/db/prisma.ts` 按 DB_TYPE 自动选择）：
>
> - mysql → `PrismaMariaDb`（`@prisma/adapter-mariadb`，连接池 connectionLimit: 10）
> - sqlite → `PrismaBetterSqlite3`（`@prisma/adapter-better-sqlite3`）

### 权限模型

使用`prisma`提供五张标准表格：`users`、`roles`、`menus`、`user_roles`、`role_menus`。

- `menus` 三级结构：`DIR`（目录）→`MENU`（菜单）→`BUTTON`（按钮），`permission` 字段存权限码
- `menus.menu_group` 字段（DB 列名 `menu_group`）：菜单分组标识，**DIR / MENU 顶层可填组名**（`""`=未分组）；前端获取 `menus` 后按 `menu_group` 分组渲染，**menu_group 为空的菜单不参与分组渲染，子级统一 `""`**；后端不校验 menu_group 取值，由配置人员按前端分组约定填写（BUTTON 权限点无需分组）
- `menu_group` 约定四组，前端侧边栏按此顺序渲染：`menu.group.General`（首页 / 数据检索）→ `menu.group.Tasks`（设计任务 / 项目管理）→ `menu.group.Settings`（系统设置 / 管理中心 / 关于）→ `menu.group.superAdmin`（超级面板：超级设置 `/super-settings` 与超级管理 `/super-admin`（DIR，下辖健康检查 / 会话中心 / 运行面板 / 运维任务 / 字典中心 / 角色中心 / 菜单中心 / 知识运维 / 权限中心九项），仅 superAdmin 角色绑定）；新增顶层 DIR/MENU 归入 `menu.group.superAdmin` 即自动排在 Settings 之后
- 权限码格式：`模块:资源:操作`，如 `adminCenter:user:list`、`adminCenter:user:create`
- `Controller `中声明所需权限：

```typescript
@Security("bearerAuth")                    // 只要登录
@Security("bearerAuth", ["adminCenter:user:list"])  // 需要指定权限码
```

- 登录接口返回 `permissions` 数组，前端可做菜单动态路由 + 按钮级控制
- 登录 / Profile 接口同时返回 `menus` 菜单树（仅当前用户可见的 DIR/MENU），刷新页面可再拉 `GET /api/v1/menu/tree`

**菜单 / 角色管理接口（RBAC 配置闭环）**

| 接口                                              | 说明                                                                       | 权限码                    |
| ------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------- |
| `GET /api/v1/menu/tree`                           | 当前用户可见菜单树（前端动态路由数据源）                                   | 仅登录                    |
| `GET /api/v1/menu/list`                           | 管理端全量菜单树（含按钮）                                                 | `superAdmin:menu:list`    |
| `POST /api/v1/menu`                               | 新增菜单 / 权限点                                                          | `superAdmin:menu:create`  |
| `PUT /api/v1/menu/{id}`                           | 更新菜单                                                                   | `superAdmin:menu:update`  |
| `DELETE /api/v1/menu/{id}`                        | 删除菜单（有子菜单拒绝，同步清理角色关联）                                 | `superAdmin:menu:delete`  |
| `GET /api/v1/menu/deleted`                        | 已删除菜单清单（回收站，扁平结构，含 parentName / deletedAt）              | `superAdmin:menu:list`    |
| `POST /api/v1/menu/{id}/restore`                  | 恢复已删除菜单（不恢复角色绑定）                                           | `superAdmin:menu:restore` |
| `GET /api/v1/role/list` · `GET /api/v1/role/{id}` | 角色列表 / 详情（含绑定菜单）                                              | `superAdmin:role:list`    |
| `POST /api/v1/role`                               | 新增角色（可同时绑定菜单）                                                 | `superAdmin:role:create`  |
| `PUT /api/v1/role/{id}`                           | 更新角色（menuIds 传入即整体重建绑定）                                     | `superAdmin:role:update`  |
| `DELETE /api/v1/role/{id}`                        | 删除角色（被用户引用时拒绝；内置角色 admin/operator/viewer 禁止删除/停用） | `superAdmin:role:delete`  |
| `PUT /api/v1/role/{id}/menus`                     | 单独重建角色-菜单绑定                                                      | `superAdmin:role:assign`  |
| `PUT /api/v1/role/{id}/permissions`               | 按权限码整体重建角色-菜单绑定                                              | `superAdmin:role:assign`  |

内置角色 `admin` / `operator` / `viewer` 仅禁止删除和停用；菜单绑定与权限点可由超级管理员通过 `PUT /role/{id}/menus` 或 `PUT /role/{id}/permissions` 重新分配。

用户-角色分配：`POST/PUT /api/v1/user` 传 `roleCodes` 数组即可（user 模块内置支持）。

- 用户列表 `GET /api/v1/user/list` 支持 `username` / `realName` 双字段模糊搜索（`?username=xxx&realName=yyy`）
- 更新用户 `PUT /api/v1/user/{id}` 支持修改 `username`（变更时自动查重，重复返回 `USER_ALREADY_EXIST`）
- 批量删除 `POST /api/v1/user/batch-delete`（body `{ "ids": number[] }`，1~100 个，软删除 + 清理角色绑定，需 `adminCenter:user:delete`；任一 id 不存在整体返回 `USER_NOT_EXIST`，成功返回 `data.deleted`）
- 管理员重置密码 `POST /api/v1/user/{id}/reset-password`（需 `adminCenter:user:update`，无 body）：固定重置为 `666666`，并置 `mustChangePassword=1`，下次登录强制改密。
- 自助注册审核：`POST /api/v1/auth/register` 成功后写入 `status=2`（待审核）+ `mustChangePassword=1`，返回 `{ username, status: 2, approvalRequired: true }`，`msg=REGISTER_PENDING_APPROVAL`；待审核账号登录返回 `20016`，不签发 token。
- 审核接口：`POST /api/v1/user/{id}/approve` / `POST /api/v1/user/{id}/reject`（均需 `adminCenter:user:update`，无 body）。通过置 `status=1` 并保留 `mustChangePassword=1`，首次登录仍强制改密；驳回直接置 `status=0`（禁用），不引入第四种状态。
- 审核幂等与边界：`approve` 对 `status=1` 幂等成功、对 `status=0` 返回 `20004`；`reject` 对 `status=0` 幂等成功、对 `status=1` 返回 `20017`；两者对其他非 `2` 状态均返回 `20017`。
- `users.status` 三态：`0 禁用` / `1 正常` / `2 待审核`；历史已注册用户保持 `1`，只有新自助注册走 `2`；管理员创建用户固定 `1`。
- 用户列表 `GET /api/v1/user/list` 的 `status` 支持 `0/1/2`，可筛选待审核账号。
- 操作安全（RBAC 保护）：禁止删除/禁用自己（`USER_SELF_OPERATION_FORBIDDEN`）；最后一个启用中的 admin 用户不可删除/禁用/降级（`ADMIN_LAST_PROTECTED`）；超级管理员账号（`superAdmin`）对非超管完全隐藏，禁止修改/删除（`SUPER_ADMIN_PROTECTED`）；角色层级固定为 `superAdmin(100) > admin(50) > operator(20) > viewer(10)`，自定义角色按 0 级，修改/删除/批量删除只能针对严格低于自己的账号，同级或更高级返回 `USER_ROLE_LEVEL_FORBIDDEN`（20011）；`roleCodes` 必须全部为启用中的角色，且不得高于自己，否则返回 `ROLE_NOT_FOUND` 或 `USER_ROLE_LEVEL_FORBIDDEN`
- 会话安全（token 版本号）：`users.token_version` 初始 0，改密 / 禁用（status=0）/ 删除（软删）时 +1；JWT 载荷携带 `v`，鉴权中间件每次请求比对，版本不一致即 401（旧令牌立即失效，需重新登录）；refresh 同样校验用户状态与版本

- 首次登录强制改密：`must_change_password=1` 时，除改密、资料、登出外的接口统一返回 `20015`；改密成功 `token_version + 1` 并强制重新登录。
- 角色契约：`POST /api/v1/auth/profile` 与登录返回的 `userInfo` 均包含 `role`（string | null，按 `ROLE_LEVEL` 取最高级别的主角色 code）和 `roles`（`{ id, code, name, description }[]`，仅启用角色，按角色级别降序、同级按 id 升序）。`permissions` 为所有启用角色菜单权限的并集；停用角色不贡献 `role` / `roles` / `permissions` / `menus`。
- 时间字段：登录返回的 `userInfo` 与 `POST /api/v1/auth/profile` 均包含 `createdAt`（注册时间）和 `lastLoginAt`（最后登录时间，从未登录为 `null`）。登录响应中的 `lastLoginAt` 是本次登录时间；`profile` 返回数据库当前值。两者均由后端序列化为 ISO 8601 字符串（UTC），前端按本地时区格式化展示。
- `menus.visible` 字段：1 显示 / 0 隐藏（有权限但不出现在侧边栏）
- 配置方式：新项目改 `prisma/seed.ts` 的 `BUILTIN_MENUS`（每项含 `mockId`，`parentMockId` 引用父项；DIR/MENU 顶层可填 `menu_group` 分组标识；隐藏权限点 type=BUTTON visible=0 提供接口权限码）重灌，或运行后用菜单/角色管理接口在线配置

**菜单维护统一规则（四模板一致）**

- 类型联动必填：DIR 必填 `path`（仅站内 `/` 路径）；MENU 必填 `path`、`permission`，站内菜单必填 `component`，外链菜单（`http/https`）`component` 必须为空；BUTTON 必填 `parentId`、`permission`，`path` / `component` 必须为空且 `visible` 固定 `0`。字段不满足返回 `10003`，`msg` 形如 `PARAM_INVALID:component`，前端可精确提示到字段。
- `path` 全局唯一：非空 `path` 在未删除菜单中唯一（外链地址同样参与查重），重复返回 `40009`；删除后 `path` 释放，恢复时若已被新菜单占用同样返回 `40009`。
- 删除与恢复：删除为软删并清理 `role_menus`；`GET /api/v1/menu/deleted` 查看回收站，恢复只恢复节点本身、不恢复角色绑定；父节点仍在回收站返回 `40010`，重复恢复返回 `40011`。`superAdmin:menu:restore` 由 seed 的隐藏权限点 `mockId 2030` 提供。

### 系统参数双域接口

配置按 `configScope` 分为 `system`（5 项）与 `super`（41 项），一个键只属于一个域，不做同键双写；取值优先级为数据库值 > 环境变量兜底 > 代码默认值。注册表 `src/config/config.registry.ts` 是键、域、分组、类型、默认值、校验和 env 兜底的唯一权威来源，运行时缓存由 `src/config/runtimeConfig.ts` 维护，写入后即时生效。

| 模块     | 方法与路径                         | 权限码                         | 说明                                                                                                                                       |
| -------- | ---------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 系统设置 | `GET /api/v1/config/all`           | 登录即可                       | 只返回 `readScope=all` 的 15 项，按 `sort,id` 升序；其中 super 域的站点/法务/上传/版本 10 项 `editable` 固定为 `0`                         |
| 系统设置 | `GET /api/v1/config/public`        | 无需登录                       | 匿名只读子集，固定 11 项：站点 4（含 `appVersion`）、法务/联系 5、`default_locale`、`register_enabled`；不含超时、帮助、AI、邮件等内部参数 |
| 系统设置 | `PUT /api/v1/config`               | `systemSettings:config:update` | body `{ key, value }`，只写 system 域 5 项；`default_locale` / `request_timeout` / `help_mode` / `help_answer_policy` / `register_enabled` |
| 超级设置 | `GET /api/v1/super-admin/settings` | `superAdmin:settings:list`     | 返回 super 域 41 项（其中 mail 组 15 项、log 组 1 项），字段与 `GET /config/all` 一致                                                      |
| 超级设置 | `PUT /api/v1/super-admin/settings` | `superAdmin:settings:update`   | body `{ key, value }`，只写 super 域 41 项                                                                                                 |

口径说明：

- 所有参数值统一按字符串传输；后端按 `valueType + validation` 校验，不合规返回 `30008 CONFIG_VALUE_INVALID`。
- 用错域写入返回 `30007 CONFIG_SCOPE_DENIED`；key 不存在返回 `30009 CONFIG_NOT_FOUND`；参数停用，或 `system` 域 `editable=0` 返回 `30006 CONFIG_NOT_EDITABLE`。超级设置域由 `superAdmin:settings:update` 控制，接口返回的 `editable` 恒为 `1`。
- 返回字段为 `id / configKey / configValue / description / editable / configScope / configGroup / readScope / valueType / defaultValue / validation / sensitive / envKey / restartRequired / sort / status / source / createdAt / updatedAt`；`source` 表示生效值来自 `db` / `env` / `default`。
- 有 env 兜底的键为 `ai_service_url`、`ai_model_name`、`ai_timeout`、`upload_max_size_mb`、`login_max_failures`、`login_lock_minutes`；密钥、数据库连接、端口等基础设施参数不进入配置表。
- `GET /config/all` 的 15 项 = system 域 5 项 + super 域公开只读 10 项（站点 4（含 `appVersion`）、法务/联系 5、上传上限 1）。
- `register_enabled` 是自助注册开关：默认 `false`（关闭），`/config/public` 与 `/config/all` 均可读；`PUT /config` 仅接受 `true` / `false`（兼容 `1` / `0`）。关闭时 `POST /auth/register` 返回 `20013`；开启后注册账号落为 `status=2` 待审核，需管理员调用 `approve` 后才能登录；管理员创建用户不受该开关影响。
- `GET /config/public` 白名单固定为 11 项（不含上传上限），用于登录前读取站点名/描述/版权/语言/法务信息与自助注册开关；`GET /config/all` 仍要求登录。
- `appVersion` 是站点软件版本展示项：`scope=super`、`readScope=all`、默认空值；系统设置只读，超级设置可写。
- 所有带 `envKey` 的参数在 seed 时从同名 env 读取并写入 `config_value`；重跑 seed 只补 `NULL`，不覆盖页面已保存值。
- 参数所属域、分组、读取域、排序和校验以注册表为准；数据库列只保存元数据快照，旧库未同步也不会让参数跨域可写。
- 升级已有库时，先执行建表/迁移命令，再执行一次 `db:seed`。种子按注册表幂等补齐缺失键并同步元数据，不覆盖已有 `config_value`。

### 邮件服务（SMTP + IMAP）

邮件服务是独立后端底座：SMTP 发信、IMAP 回读确认、测试邮件与验证码邮件模板。忘记密码已复用 `mailService.sendVerificationCode`，通知中心已复用 `mailService.sendNotificationMail` 逐收件人发信，不再各自搭一套发信逻辑。

mail 参数归超级设置，`configGroup=mail`、`configScope=super`、`readScope=super`，共 15 项（sort 140–154）。首次 seed 从 `.env` 的 `MAIL_INIT_USER` / `MAIL_INIT_PASS` / `MAIL_INIT_FROM` 写入真实账号与授权码，`.env.example` 只写占位；seed 幂等，不覆盖页面已保存值。

| 方法与路径                                     | 权限码                       | 说明                                                                                                                                |
| ---------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/super-admin/settings/batch`      | `superAdmin:settings:update` | body `{ items: [{ key, value }] }`，1–50 项，单事务；任一项非法则整体失败                                                           |
| `GET /api/v1/super-admin/settings/mail/status` | `superAdmin:settings:list`   | 返回 `enabled / configured / passSet / smtp / imap / lastTest / lastBusiness`                                                       |
| `GET /api/v1/super-admin/settings/mail/logs`   | `superAdmin:settings:list`   | query `limit`（1–100，默认 20）/ `template`（`mail_test` 或 `verification_code`）；按 id 倒序返回测试与业务发信记录                 |
| `POST /api/v1/super-admin/settings/mail/test`  | `superAdmin:settings:update` | body `{ mode?: "full" \| "send" \| "verify", to?: string }`，默认 `full`；`to` 不传时发给发件邮箱自己，传外部收件人时跳过 IMAP 回读 |

口径说明：

- 配置值统一按字符串传输；`mail_smtp_pass` 标记 `sensitive: true`，接口只返回掩码 `******`，提交 `******` 表示不修改，提交空串返回 `30008`，不加密存储。
- 测试判定以 IMAP 回读为准：`full` 模式发送带唯一 `testId` 的测试邮件，再用 `imap.qq.com:993` 拉取每个文件夹最近 50 封邮件信封，按 subject / messageId 本地匹配 `testId`；回读同时检查 INBOX 与垃圾箱（QQ 的 Junk 为 `&XfJT0ZAB-`），`received=true` 才算「可用」，`receivedFolder` 标明落点 `INBOX` / `JUNK`。SMTP 的 `250 accepted`、`send`/`verify` 模式通过都不能证明进箱。
- 回读失败不抛 HTTP 错误：仍返回 `code=200`，失败原因在 `data.readbackError`（`MAIL_NOT_RECEIVED`、`MAIL_IMAP_FAILED: ...` 或 `MAIL_DELIVERED_TO_JUNK`），前端必须按 `received` 判定；落点为垃圾箱时该条日志的 `error` 也记 `MAIL_DELIVERED_TO_JUNK`。
- 外部收件人无法用发件账号 IMAP 回读：`data.readbackEnabled=false`、`data.readbackError=MAIL_READBACK_SKIPPED_EXTERNAL_RECIPIENT`，此时只证明 SMTP 接受。
- 测试接口故意绕过 `mail_enabled` 开关（`ignoreEnabled: true`）；总开关只拦业务发信，不拦测试。
- 回读超时 `mail_test_readback_timeout_ms` 默认 60000 ms（校验范围 5000–120000），前端调用测试接口的请求超时建议不低于 70 秒。
- `mail_logs` 只记录 `id / user_id / to_email / subject / template / status / test_id / message_id / error / created_at / sent_at / received_at`，不记正文、验证码、授权码；测试日志 `template=mail_test`，业务发信（忘记密码验证码）`template=verification_code`，均按 `pending → sent → received / failed` 记录。
- 新增错误码 `90001`–`90010`：未配置、已关闭、SMTP 登录失败、SMTP 连接失败、超时、发送失败、收件人非法、未回读、IMAP 未配置、IMAP 失败；`90008` / `90010` 出现在 `readbackError` 而不是响应 `code`。
- 依赖 `nodemailer` / `imapflow` 已写入 `package.json`；首次 install 前 `mail.service.ts` 无法 import，需先 `npm install`。
- QQ 个人邮箱对「陌生发件人 + 验证码」邮件容易判垃圾：即使 SMTP 返回 `250 accepted`，收件人仍可能只会在垃圾箱看到。后台用 `/mail/logs` 看 `sent` 记录，用测试接口的 `receivedFolder` 看落点；产品侧应在忘记密码页提示用户检查垃圾箱，长期方案是换企业邮箱/自有域名并配置 SPF、DKIM。

### 通知中心与日志中心

通知与日志都复用现有邮件体系（SMTP / IMAP + `mail_logs`），不新建公告表，也不新建登录日志表。

**通知中心**

- 统一门面 `notificationService.notify({ userIds?, roles?, category, type, title, content, source, link?, templateKey?, data?, sendEmail?, senderId? })`，返回 `{ batchId, recipientCount, emailQueued, emailSkipped }`。
- 四个分类：`system` / `security` / `business` / `announcement`；级别复用 `type`（`info` / `success` / `warning` / `error`），不新增 `level` 字段。
- 收件人 = `userIds ∪ roles`，只取 `status=1 && isDeleted=0`；站内通知逐收件人插行，保证必达；邮件异步逐人发送，失败不回滚业务。
- `notifications` 扩 `category / source / link / sender_id / batch_id / template_key / email_status / email_error / read_at`；同一批发送共用一个 `batchId`。
- 邮件双开关：`mail_notify_enabled`（默认 `false`）与 `mail_enabled` 同时为 `true` 才发信；收件人邮箱为空时记 `emailStatus=skipped`、`emailError=MAIL_RECIPIENT_EMPTY`。
- 管理员手动发送不允许定向 `superAdmin`；受众解析后为空返回 `91002`。
- 不做撤回；删除 `POST /api/v1/notification/create`，站内通知统一走服务层门面。

| 方法与路径                                                      | 权限码                      | 说明                                                                                                                             |
| --------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/notification/list`                                 | 登录即可                    | query `page` / `pageSize` / `category` / `type` / `isRead`                                                                       |
| `GET /api/v1/notification/unread-count`                         | 登录即可                    | 返回 `{ count }`                                                                                                                 |
| `POST /api/v1/notification/read/{id}`                           | 登录即可                    | 标记单条已读，补 `readAt`                                                                                                        |
| `POST /api/v1/notification/read-all`                            | 登录即可                    | 全部已读，补 `readAt`                                                                                                            |
| `GET /api/v1/notification/admin/batches`                        | `adminCenter:notice:manage` | query `page` / `pageSize` / `category` / `type` / `source` / `keyword`；按 `batchId` 聚合                                        |
| `GET /api/v1/notification/admin/batches/{batchId}`              | `adminCenter:notice:manage` | 批次详情，含收件人、已读与邮件状态                                                                                               |
| `POST /api/v1/notification/admin/send`                          | `adminCenter:notice:send`   | body `{ title, content, category, type, audience: { type: "all" \| "role" \| "user", roleCodes?, userIds? }, link?, sendEmail }` |
| `POST /api/v1/notification/admin/batches/{batchId}/retry-email` | `adminCenter:notice:manage` | 仅重试该批次 `emailStatus=failed` 的收件人                                                                                       |

通知邮件的模板名为 `notify_system` / `notify_security` / `notify_business` / `notify_announcement`，按分类自动选择；配置表没有 `site_url`，因此只有 `link` 为 `http(s)` 时才在邮件里渲染「去处理」按钮。

站内通知事件接线：

- 注册待审核 → `register_pending`（发给 admin / superAdmin，不发邮件）
- 注册通过 / 驳回 → `register_approved` / `register_rejected`
- 修改密码 / 忘记密码重置 / 管理员重置 → `password_changed` / `password_reset` / `password_admin_reset`
- 账号被禁用 → `account_disabled`
- 强制下线单会话 / 批量 → `session_revoked`

**日志中心**

- 三类日志：`operation`、`login`（并入 `operation_logs`）、`mail`（`mail_logs`）；Pino 运行日志只落文件，不入库、不在页面展示，通过 `requestId` 与业务日志关联。
- `operation_logs` 扩 `category / result / reason / target / user_agent / request_id`，并补 `(category, id)`、`(username, id)`、`(created_at)` 索引。
- 操作日志中间件覆盖 `POST / PUT / PATCH / DELETE`，成功和失败都记录：包装 `res.json` 读取业务码判定 `success / failed / blocked`；`action` 对 APPROVE / REJECT / REVOKE / CLEANUP / REINDEX / TEST 特判；`target` 取路径末段；不解析请求体；跳过 `/auth/login`、`/auth/logout`、`/auth/refresh`、`/notification/read*`。
- 登录流水写在 auth controller：成功与失败都落 `LOGIN`，登出落 `LOGOUT`；失败时 `userId=null`，`reason` 用现成错误码。

| 方法与路径                        | 权限码                    | 说明                                                                                                                                                |
| --------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/log-center/list`     | `adminCenter:log:list`    | query `page` / `pageSize` / `category`（`operation` \| `login` \| `mail`）/ `module` / `action` / `result` / `username` / `keyword` / `from` / `to` |
| `GET /api/v1/log-center/summary`  | `adminCenter:log:list`    | query `range`（`24h` \| `7d` \| `30d`），返回三类日志数量与结果分布                                                                                 |
| `POST /api/v1/log-center/cleanup` | `adminCenter:log:cleanup` | body `{ beforeDays?, confirm: "CLEANUP" }`；缺 `confirm` 返回 `92001`，不传 `beforeDays` 时读 `log_retention_days`（默认 90）                       |
| `GET /api/v1/operate-log/list`    | `adminCenter:log:list`    | 兼容别名，固定 `category=operation`，新增 `keyword`                                                                                                 |

- 非超管查询会强制过滤 `superAdmin` 记录：operation / login 按 `username`，mail 按 `user_id` 反查排除。
- 权限范围：`superAdmin` / `admin` 可见三类日志；`operator` / `viewer` 不可见。
- 自动清理不随服务启动执行，保留 P0 为超管手动清理；P1 可挂运维任务，沿用 `log_retention_days`。

**权限与种子**

- 新增隐藏按钮权限点：`2036` `adminCenter:notice:send`、`2037` `adminCenter:notice:manage`、`2038` `adminCenter:log:cleanup`。
- `admin` 角色绑定 28 项，含 `2036` / `2037`，不含仅超管可用的 `2038`；`superAdmin` 绑定 62 项。
- seed 落库：菜单 65 项、系统参数 46 项。

**错误码与配置**

- `91001 NOTIFICATION_NOT_FOUND`：通知或通知批次不存在。
- `91002 NOTIFICATION_RECIPIENT_EMPTY`：通知收件人为空。
- `91003 NOTIFICATION_AUDIENCE_INVALID`：通知受众参数不合法。
- `92001 LOG_CLEANUP_CONFIRM_REQUIRED`：日志清理缺少二次确认。
- 新增配置：`mail_notify_enabled`（super / mail / boolean / 默认 false / sort 154）、`log_retention_days`（super / log / number / 默认 90 / 1–3650 / sort 160）。

### 忘记密码（公开接口）

忘记密码走邮箱验证码流程，两个接口都不需要登录态；登录页与忘记密码页均可直接调用。

| 方法与路径                          | 说明                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| `POST /api/v1/auth/password/forgot` | body `{ username, email, captchaId, captchaCode }`，校验图形验证码后发送 6 位邮箱验证码 |
| `POST /api/v1/auth/password/reset`  | body `{ username, email, code, newPassword }`，校验邮箱验证码后重置密码                 |

口径说明：

- 用户名 + 邮箱双匹配，并过滤 `isDeleted=0`、`status=1`、`isSuper=0`；隐藏的 superAdmin 不可被重置。
- 申请阶段先按用户名 + 邮箱匹配账号，匹配失败直接返回 `20012`，不再进入验证码步骤；60 秒重发冷却仍返回统一成功结构。真实发信失败只写 `logger.warn`，不改变响应。
- 验证码 6 位数字，10 分钟有效，同一账号只保留最新一枚；库中只存 `sha256(userId:email:code)`，不存明文。
- 提交阶段同一验证码最多尝试 5 次；第 5 次失败返回 `20010`，错误或过期返回 `20009`。第 5 次后即使输入正确验证码也会被拒绝，必须重新申请。
- 申请阶段要求图形验证码（复用登录页 `captchaId` + `captchaCode`），提交阶段不再要求图形验证码。
- 重置成功返回 `{ username }`，同时 `tokenVersion + 1`、吊销全部 refresh token、清空登录失败记录，**不自动登录**，前端必须跳回登录页重新登录。
- 两个接口按 IP 走 `loginRateLimitMiddleware`（默认 10 次/分钟），命中返回 HTTP 429 + `code=10106`。
- 邮件主题按 `[siteName] 重置密码验证码` 渲染；`mail_enabled=false` 时业务发信会被 `MAIL_DISABLED` 拦截，但申请接口在账号校验通过后仍返回统一成功结构（用户收不到码）。
- 每次业务发信都会落 `mail_logs`（`template=verification_code`，`status` 为 `sent` / `failed`，`test_id` 形如 `verify-<uuid>`）；后台可在 `/api/v1/super-admin/settings/mail/logs?template=verification_code` 查看，不再出现「系统没发信」的黑盒。
- 自测提醒：seed 的 `admin` 邮箱是 `admin@example.com`，不会真实收信；`superAdmin` 被 `isSuper=0` 过滤，也不在找回范围。要收到邮件，先把账号邮箱改成真实邮箱，并保证输入的用户名、邮箱与 `users` 表完全一致。邮箱不匹配时接口返回 `20012`，不会生成验证码，服务端写一条 `Password reset rejected` 警告日志。
- 新增错误码 `20009`（重置密码验证码错误或已过期）、`20010`（重置密码验证码尝试次数过多）、`20012`（用户名与邮箱不匹配）；新增消息码 `PASSWORD_RESET_CODE_SENT`、`PASSWORD_RESET_SUCCESS`。
- 新增表 `password_reset_codes`（`user_id / email / code_hash / attempts / expires_at / used_at / created_at`），prisma 版随 migration 建表，manual 版随 `scripts/schema.*.sql` 建表。

### 注册开关与首次登录强制改密

**注册开关（系统配置）**

- 配置键 `register_enabled`：`scope=system`、`group=general`、`readScope=all`、`type=boolean`、`defaultValue=false`、`sort=22`。
- 默认关闭。关闭时 `POST /api/v1/auth/register` 直接返回 `20013 REGISTER_DISABLED`；`PUT /api/v1/config` 可写，`GET /api/v1/config/public` 匿名可读。
- 开启后自助注册账号初始 `status=2`（待审核）、`mustChangePassword=1`；待审核登录返回 HTTP 200 + 业务码 `20016 USER_PENDING_APPROVAL`，需管理员调用 `POST /api/v1/user/{id}/approve` 后才会转为正常账号。
- 管理员通过 `POST /api/v1/user` 创建账号走独立路径，不受该开关影响。
- 登录页仍从 `/config/public` 读取站点与法务配置，同时读取 `register_enabled`；值为 `"false"` 时不要展示注册入口。

**首次登录强制改密**

- `users.must_change_password`（Prisma 字段 `mustChangePassword`）默认 `0`。管理员创建用户、管理员在 `PUT /api/v1/user/{id}` 修改他人密码、管理员重置密码后置 `1`。
- 登录与 `POST /api/v1/auth/profile` 都会返回 `mustChangePassword`（boolean）；前端登录成功后应先判断该字段，再决定是否进入业务页。
- 未改密时仅放行 `POST /api/v1/auth/password/change`、`POST /api/v1/auth/profile`、`POST /api/v1/auth/logout`；其余接口返回 HTTP 200 + 业务码 `20015 PASSWORD_CHANGE_REQUIRED`，前端按 body.code 判断。
- `POST /api/v1/auth/password/change`：需登录，body `{ oldPassword, newPassword }`。首次改密也必须输入旧密码；`newPassword` 走 8–32 位强度校验，不能与旧密码相同（`20014`）。成功返回 `{ reloginRequired: true }`，同时 `token_version + 1` 并吊销全部 refresh token，旧 access token 立即失效。前端必须清空本地登录态并跳回登录页，不能停留在原页面。
- `POST /api/v1/user/{id}/reset-password`：需 `adminCenter:user:update`，无 body。管理员重置密码固定为 `666666`（常量在 `src/constants/password.ts` 的 `ADMIN_RESET_PASSWORD`），接口成功返回 `null`（`msg=更新成功`），前端按固定规则提示即可。
- `666666` 仅作为管理员重置后的初始密码，只够登录一次；登录即被强制改密，改完强制重新登录。该密码不写入日志、不写入邮件，也不参与注册与忘记密码的强度校验。
- 忘记密码重置成功会清除 `must_change_password`（用户已自行设置新密码，不再强制），同时 `token_version + 1`，不自动登录。
- 错误码：`20013 REGISTER_DISABLED`、`20014 PASSWORD_SAME_AS_OLD`、`20015 PASSWORD_CHANGE_REQUIRED`、`20016 USER_PENDING_APPROVAL`、`20017 USER_NOT_PENDING_APPROVAL`。

### 运维中心接口

四组运维能力挂在超级管理员权限下：列表接口用页面权限码（进入页面即可查看），写操作走按钮权限码（按钮本身 `visible=0`，仅提供接口鉴权）。

| 模块     | 方法与路径                                        | 权限码                                                       | 说明                                                                                                                                        |
| -------- | ------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 健康检查 | `GET /api/v1/super-admin/health/checks`           | `superAdmin:healthCheck:list`                                | 六项探测 database / memory / disk / logger / helpIndex / aiDependency，query `keys` 逗号分隔（不传跑全部）                                  |
| 健康检查 | `POST /api/v1/super-admin/health/probe`           | `superAdmin:health:probe`                                    | 立即探测，body `{ keys?: string[] }`                                                                                                        |
| 会话中心 | `GET /api/v1/super-admin/sessions`                | `superAdmin:sessionCenter:list`                              | query `page` / `pageSize` / `status`（active \| expired \| revoked）/ `keyword`；summary 恒按全量统计                                       |
| 会话中心 | `POST /api/v1/super-admin/sessions/:id/revoke`    | `superAdmin:session:revoke`                                  | body `{ force?: boolean }`；吊销后该会话的 access token 立即失效（单端下线），`force=true` 时同时提升该用户 token_version，使其全端立即下线 |
| 会话中心 | `POST /api/v1/super-admin/sessions/revoke-batch`  | `superAdmin:session:revoke`                                  | body `{ ids: number[], force?: boolean }`                                                                                                   |
| 会话中心 | `POST /api/v1/super-admin/sessions/cleanup`       | `superAdmin:session:cleanup`                                 | body `{ beforeDays?: number }`（1–365，不传时读 `session_cleanup_keep_days`，默认 7），删除已过期或已吊销且早于阈值的记录                   |
| 运行指标 | `GET /api/v1/super-admin/metrics/overview`        | `superAdmin:metricsCenter:list`                              | query `range`（1h \| 6h \| 24h）；返回 totals / current / series                                                                            |
| 运行指标 | `POST /api/v1/super-admin/metrics/reset`          | `superAdmin:metrics:reset`                                   | 清空内存分桶，返回影响面                                                                                                                    |
| 运维任务 | `GET /api/v1/super-admin/ops/tasks`               | `superAdmin:taskCenter:list`                                 | 四项任务：session-cleanup / help-reindex / db-backup / db-reseed                                                                            |
| 运维任务 | `POST /api/v1/super-admin/ops/tasks/:key/run`     | `superAdmin:task:run`                                        | 执行非危险任务，危险任务调用返回 `60008`                                                                                                    |
| 运维任务 | `POST /api/v1/super-admin/ops/reseed`             | `superAdmin:task:run` + `superAdmin:task:danger`             | body `{ confirm: "RESEED" }`                                                                                                                |
| 知识库   | `GET /api/v1/help/admin/locales`                  | `superAdmin:knowledgeCenter:list`                            | 语言目录 + manifest 有效性 + 文档/索引统计                                                                                                  |
| 知识库   | `POST /api/v1/help/admin/locales/:locale/init`    | `superAdmin:help:slot:manage`                                | 建语言目录 + 空 `help.manifest.json`，已存在则返回 `created=false`                                                                          |
| 知识库   | `PATCH /api/v1/help/admin/locales/:locale`        | `superAdmin:help:slot:manage`                                | 改展示名；body 传 `newLocale` 时改目录名并平移该语言索引                                                                                    |
| 知识库   | `DELETE /api/v1/help/admin/locales/:locale`       | `superAdmin:help:slot:manage`                                | 物理删除语言目录与索引，`confirm=locale`，不保留备份                                                                                        |
| 知识库   | `GET /api/v1/help/admin/slots`                    | `superAdmin:knowledgeCenter:list`                            | 管理树（section/chapter/doc）+ orphan 文件 + 统计，query `locale`                                                                           |
| 知识库   | `GET /api/v1/help/admin/slots/file-options`       | `superAdmin:help:slot:manage`                                | 可枚举文件清单（`used` / `docKey`），query `locale` / `keyword` / `contentType` / `page` / `pageSize`                                       |
| 知识库   | `POST /api/v1/help/admin/slots`                   | `superAdmin:help:slot:manage`                                | 新建文档位，只写 manifest                                                                                                                   |
| 知识库   | `PUT /api/v1/help/admin/slots/:docKey`            | `superAdmin:help:slot:manage`                                | 改标题/摘要/排序/文章 path                                                                                                                  |
| 知识库   | `DELETE /api/v1/help/admin/slots/:docKey`         | `superAdmin:help:slot:manage`                                | 删文档位（manifest + 文件 + 索引），`confirm=docKey`                                                                                        |
| 知识库   | `GET /api/v1/help/admin/slots/:docKey`            | `superAdmin:knowledgeCenter:list`                            | 文档位详情（含所属 section/chapter）                                                                                                        |
| 知识库   | `GET /api/v1/help/admin/slots/:docKey/content`    | `superAdmin:knowledgeCenter:list`                            | 正文 + `baseHash` 乐观并发基线                                                                                                              |
| 知识库   | `GET /api/v1/help/admin/slots/:docKey/file`       | `superAdmin:knowledgeCenter:list`                            | 下载/预览原文件（inline）                                                                                                                   |
| 知识库   | `PUT /api/v1/help/admin/slots/:docKey/content`    | `superAdmin:help:doc:create` 或 `superAdmin:help:doc:update` | `multipart/form-data`，字段 `file`，可选 `baseHash`                                                                                         |
| 知识库   | `DELETE /api/v1/help/admin/slots/:docKey/content` | `superAdmin:help:doc:delete`                                 | 清空正文（保留槽位），`confirm=docKey`                                                                                                      |
| 知识库   | `POST /api/v1/help/admin/assets`                  | `superAdmin:help:doc:update`                                 | 图片上传（png/jpg/jpeg/webp/gif，≤5MB）                                                                                                     |
| 知识库   | `POST /api/v1/help/admin/reindex`                 | `superAdmin:help:reindex`                                    | 幂等全量重建索引，等价 `npm run help:index`                                                                                                 |
| 知识库   | `GET /api/v1/help/admin/index/status`             | `superAdmin:knowledgeCenter:list`                            | 各语言索引状态 + 汇总，query `locale` 可只看单一语言                                                                                        |

### 超级面板菜单结构（四模板一致）

| 节点                                                                                             | 类型   | 路径              | 权限码                          | 说明                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------ | ------ | ----------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 超级设置                                                                                         | MENU   | `/super-settings` | `superAdmin:settings:list`      | 独立页面、无子菜单；读取走 `GET /api/v1/super-admin/settings`（super 域 41 项，含 mail 15 项、log 1 项），保存走 `PUT /api/v1/super-admin/settings`（需 `superAdmin:settings:update`） |
| 超级设置-配置更新                                                                                | BUTTON | —                 | `superAdmin:settings:update`    | mockId 2031，挂在超级设置菜单下，`visible=0`，仅提供接口鉴权                                                                                                                           |
| 超级管理                                                                                         | DIR    | `/super-admin`    | `superAdmin:center:list`        | 目录容器，仅作菜单树标识，无对应后端接口                                                                                                                                               |
| 健康检查 / 会话中心 / 运行面板 / 运维任务 / 字典中心 / 角色中心 / 菜单中心 / 知识运维 / 权限中心 | MENU   | `/super-admin/*`  | 各模块 `superAdmin:<模块>:list` | 超级管理下的二级菜单：`icon` 与 `menu_group` 留空、sort 1–9，path / component / permission 保持原值                                                                                    |

口径说明：

- 会话状态由 `revoked` 与 `expires_at` 实时推导，不落库。access token 携带会话号（`sid`，即 `refresh_tokens.id`），鉴权时校验该会话是否已吊销或已过期，因此吊销单条会话会让其 access token 立即失效（单端下线）；`force=true` 还会把 `users.token_version` 加一，使该用户所有已签发令牌一并失效（全端下线）。
- 登出接口 `POST /api/v1/auth/logout`（Bearer access token，无请求体）会把该用户全部未吊销会话置为吊销，登出后原 access token 立即失效（10103）。
- 鉴权失败统一返回 HTTP 200 + 业务码：10101 未带凭证、10102 令牌已过期、10103 令牌无效或会话已被吊销；前端判断登录态请读响应体 `code`，不要依赖 HTTP 状态码。
- 指标为进程内采集：每分钟一个桶，保留小时数由 `metrics_retention_hours` 控制（1–24，默认 24）；错误指 HTTP 状态码 ≥500；p95 取样本排序后第 `ceil(n*0.95)` 位。
- 健康检查整体状态按最差项汇总：任一 fail → `down`，任一 warn → `degraded`，全部 ok → `up`；AI 服务地址取 `ai_service_url`（DB > env `OLLAMA_BASE_URL` > 默认值）。
- 运维任务执行记录只存内存（重启清空）；同一任务并发调用返回 `60004`；危险任务必须走专用接口（普通接口返回 `60008`）且口令须为 `RESEED`（否则 `60005`）。
- 备份实现集中在 `src/utils/dbBackup.ts`，脚本 `npm run backup` 与任务中心 `db-backup` 共用同一份逻辑。
- 日志轮转：`logs/app.log` 达到 `LOG_MAX_SIZE_MB`（默认 10MB）即切分为 `app-YYYYMMDD-HHMMSSmmm.log`，历史文件按 `LOG_MAX_FILES`（默认 7）只保留最新若干份；健康检查 `logger` 项读当前文件大小、上限与历史份数（`LOG_CONSOLE=false` 时仅写文件，不影响轮转）。
- 健康检查 `keys` 可省略（不传即全量）；传入的 key 全部无效时返回 `10003`（`PARAM_INVALID`）；单项状态含 `skip`（如未配置 `OLLAMA_BASE_URL`），整体只由 fail / warn 推导，因此仅查 AI 依赖且未配置时整体为 `up`，前端需按 items 判断。
- 成功响应 `code` 恒为 `200`（`ERROR_CODE.SUCCESS`），Swagger UI 里显示的 `code: 0` 只是 schema 未写示例时的占位，不是真实返回。

### 登录安全

| 能力       | 实现                                          |
| ---------- | --------------------------------------------- |
| 密码存储   | bcrypt 哈希（10 轮）                          |
| 登录验证码 | SVG 图形验证码，2 分钟过期，一次性            |
| 账号锁定   | 连续失败 5 次（可配）锁定 15 分钟（可配）     |
| 双令牌     | Access 15m + Refresh 7d，Refresh 只存哈希入库 |
| 登出吊销   | 吊销该用户全部 refresh token                  |
| 接口限流   | 全局 300/15min，登录接口 10/min               |
| 安全头     | helmet 全量启用                               |
| CORS       | 生产环境白名单域名（`CORS_ORIGINS`）          |
| 密钥校验   | zod 启动校验 JWT_SECRET ≥ 32 位               |

### 数据库安全（SQLite 无密码说明）

开发默认 `DB_TYPE=sqlite` **不设数据库密码**：SQLite 为单文件库、无独立账号认证，拿到 `data/app.db` 即等于拿到全部数据。模板的防护基线：

- 文件不进仓库：`.gitignore` 已忽略 `data/` 与 `*.db`，数据库文件不会随代码提交；
- 口令不可还原：业务密码一律 bcrypt（10 轮）哈希落库，即使文件泄露也无法还原明文；
- 部署约束：生产环境将 `data/` 置于受控目录（文件系统 ACL 限制），禁止 Web 目录可下载；
- 生产建议：正式环境切换 `DB_TYPE=mysql`，使用 MySQL 自带账号认证 + 最小权限库账号（仅业务库 DML），不使用 root。

### 项目测试

#### 测试代码

`root/test/api-full-test.cjs`为测试脚本：

```js
/**
 * ============================================================
 * 全量 API 冒烟测试（api-full-test.cjs）
 * ------------------------------------------------------------
 * 覆盖 prisma-tsoa 模板全部 22 个接口路径：
 *   auth / captcha / user / upload / operate-log /
 *   notification / dict / config
 *
 * 运行前提：
 *   1. 服务已启动（npm run dev）
 *   2. 数据库已 seed（npm run db:seed，默认 admin/123456）
 *
 * 说明：
 *   - 登录接口需要图形验证码（无法自动化识别），
 *     故用 JWT 直接签发 admin access token 测试鉴权接口
 *   - 登录接口本身测试"参数校验错误"与"验证码错误"两条分支
 *   - RBAC 权限拦截也纳入断言（admin 无 config/log 权限 → 预期 10104）
 *   - 测试创建的 user / dict / notification 数据自动清理
 *
 * 用法：在项目根目录 运行  node .\test\api-full-test.cjs
 * ============================================================
 */

require("dotenv").config();
const jwt = require("jsonwebtoken");

const BASE = `http://localhost:${process.env.APP_PORT || 3000}/api/v1`;

// ---------- 工具 ----------
let passed = 0;
let failed = 0;
const failures = [];

/** 发起请求；formData 传 FormData 对象时自动 multipart */
async function req(method, path, { token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: formData ? formData : body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { http: res.status, ...json };
}

/**
 * 执行一个测试用例
 * @param {string} name 用例名
 * @param {() => Promise<{code:number,msg?:string,data?:any}>} fn 请求函数
 * @param {number|number[]} expectCode 预期业务码（单个或数组，命中其一即过）
 * @param {string} [desc] 附加说明（如 RBAC 拦截）
 */
async function test(name, fn, expectCode, desc = "") {
  try {
    const r = await fn();
    const expects = Array.isArray(expectCode) ? expectCode : [expectCode];
    if (expects.includes(r.code)) {
      passed++;
      console.log(`  ✅ PASS  ${name}${desc ? `（${desc}）` : ""} → code=${r.code} msg=${r.msg}`);
    } else {
      failed++;
      failures.push(name);
      console.log(`  ❌ FAIL  ${name}${desc ? `（${desc}）` : ""} → 预期 ${expects.join("/")}，实际 code=${r.code} msg=${r.msg}`);
      if (r.data) console.log(`          data=${JSON.stringify(r.data).slice(0, 200)}`);
    }
  } catch (e) {
    failed++;
    failures.push(name);
    console.log(`  ❌ FAIL  ${name} → 请求异常: ${e.message}`);
  }
}

// ---------- 签名 JWT（绕过验证码，按 userId 签发） ----------
function signToken(userId, username) {
  return jwt.sign({ userId, username, type: "access" }, process.env.JWT_SECRET || "change-me-in-production-0123456789abcdef", {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });
}
function adminToken() {
  return signToken(1, "admin");
}

// ---------- 唯一后缀 ----------
const TS = Date.now().toString().slice(-8);
const T = adminToken();
// 生产环境标记：NODE_ENV=production 时 Swagger 关闭、captcha 不返回 devCode，
// 登录闭环无法自动化 → 组 13 改为直签鉴权，另跑组 15 生产专属断言
const IS_PROD = process.env.NODE_ENV === "production";

// ---------- 分组执行 ----------
async function main() {
  console.log(`\n========== 全量 API 冒烟测试 ==========`);
  console.log(`Base: ${BASE}`);
  console.log(`Token: admin（JWT 签发，userId=1）\n`);

  // ================= 0. 健康检查 =================
  console.log("── 0. 健康检查 ──");
  await test("GET / 健康检查", async () => {
    const r = await fetch(`http://localhost:${process.env.APP_PORT || 3000}/`, { method: "GET" });
    return r.json();
  }, 200);

  // ================= 1. 验证码（公开） =================
  console.log("\n── 1. 验证码（公开） ──");
  let captchaId = "";
  await test("GET /api/v1/captcha 生成验证码", async () => {
    const r = await req("GET", "/captcha");
    captchaId = r.data?.captchaId || "";
    return r;
  }, 200);

  // ================= 2. 登录（公开，验证码无法自动识别） =================
  console.log("\n── 2. 登录接口（公开） ──");
  await test(
    "POST /auth/login 缺字段 → 参数校验错误",
    async () => {
      return req("POST", "/auth/login", { body: { username: "admin" } });
    },
    10003,
    "TSOA 层 PARAM_INVALID"
  );
  await test(
    "POST /auth/login 验证码错误",
    async () => {
      return req("POST", "/auth/login", {
        body: { username: "admin", password: "123456", captchaId, captchaCode: "0000" },
      });
    },
    [10201, 10202],
    "验证码校验拦截"
  );
  await test(
    "POST /auth/login 用户不存在",
    async () => {
      // 用正确格式验证码 + 不存在的用户，验证业务链路（验证码校验失败则停在 102xx）
      return req("POST", "/auth/login", {
        body: { username: "no_such_user_xx", password: "123456", captchaId, captchaCode: "0000" },
      });
    },
    [10201, 10202, 20001],
    "验证码或用户链路"
  );

  // ================= 3. 注册（公开） =================
  // 自助注册默认关闭：执行本节前先由管理员调用 PUT /config 将 register_enabled 置为 true
  console.log("\n── 3. 注册（公开） ──");
  const regUsername = `tester_${TS}`;
  await test("POST /auth/register 注册新用户", async () => {
    return req("POST", "/auth/register", {
      body: { username: regUsername, password: "Test@123456", email: `${regUsername}@test.com`, realName: "测试用户" },
    });
  }, 200);
  await test(
    "POST /auth/register 重复注册 → 用户已存在",
    async () => {
      return req("POST", "/auth/register", {
        body: { username: regUsername, password: "Test@123456", email: `${regUsername}@test.com` },
      });
    },
    20002,
    "USER_ALREADY_EXIST"
  );
  await test(
    "POST /auth/register 弱密码 → 拒绝",
    async () => {
      return req("POST", "/auth/register", {
        body: { username: `weak_${TS}`, password: "123456", email: `weak_${TS}@test.com` },
      });
    },
    [10003, 20005],
    "Joi 或强度校验"
  );

  // ================= 4. 鉴权拦截（无 token / 假 token） =================
  console.log("\n── 4. 鉴权拦截 ──");
  await test(
    "GET /user/list 无 token → 未登录",
    async () => {
      return req("GET", "/user/list");
    },
    10101,
    "UNAUTHORIZED"
  );
  await test(
    "GET /user/list 假 token → 无效",
    async () => {
      return req("GET", "/user/list", { token: "fake.token.here" });
    },
    10103,
    "TOKEN_INVALID"
  );
  await test(
    "POST /auth/profile 无 token → 未登录",
    async () => {
      return req("POST", "/auth/profile");
    },
    10101,
    "UNAUTHORIZED"
  );

  // ================= 5. auth（需登录） =================
  console.log("\n── 5. Auth（需登录） ──");
  await test("POST /auth/profile 获取当前用户+权限", async () => {
    return req("POST", "/auth/profile", { token: T });
  }, 200);
  await test(
    "POST /auth/refresh 无效 refreshToken → 拒绝",
    async () => {
      return req("POST", "/auth/refresh", { body: { refreshToken: "invalid_token_for_test" } });
    },
    [10103, 10500],
    "TOKEN_INVALID"
  );
  await test("POST /auth/logout 登出", async () => {
    return req("POST", "/auth/logout", { token: T });
  }, 200);

  // ================= 6. 用户模块 =================
  console.log("\n── 6. 用户模块 ──");
  const newUser = `user_${TS}`;
  let userId = 0;
  await test("POST /user 创建用户", async () => {
    const r = await req("POST", "/user", {
      token: T,
      body: { username: newUser, password: "Test@123456", realName: "新增用户", email: `${newUser}@test.com` },
    });
    userId = r.data?.id || 0;
    return r;
  }, 200);
  await test(
    "POST /user 用户名重复 → 已存在",
    async () => {
      return req("POST", "/user", { token: T, body: { username: newUser, password: "Test@123456" } });
    },
    20002,
    "USER_ALREADY_EXIST"
  );
  await test("GET /user/list 列表（按新用户过滤）", async () => {
    return req("GET", `/user/list?username=${newUser}`, { token: T });
  }, 200);
  await test("GET /user/{id} 详情", async () => {
    return req("GET", `/user/${userId || 1}`, { token: T });
  }, 200);
  await test("PUT /user/{id} 更新", async () => {
    return req("PUT", `/user/${userId || 1}`, { token: T, body: { realName: "更新后的姓名" } });
  }, 200);
  await test(
    "GET /user/{id} 不存在 → 用户不存在",
    async () => {
      return req("GET", "/user/999999", { token: T });
    },
    20001,
    "USER_NOT_EXIST"
  );
  await test("DELETE /user/{id} 删除（清理测试数据）", async () => {
    return req("DELETE", `/user/${userId || 1}`, { token: T });
  }, 200);

  // ================= 7. 文件上传 =================
  console.log("\n── 7. 文件上传 ──");
  await test("POST /upload/file 上传 png 文件", async () => {
    const fd = new FormData();
    fd.append("file", new Blob(["hello prisma-tsoa"], { type: "image/png" }), "test.png");
    return req("POST", "/upload/file", { token: T, formData: fd });
  }, 200);
  await test(
    "POST /upload/file 类型拒收 text/plain",
    async () => {
      const fd = new FormData();
      fd.append("file", new Blob(["hello prisma-tsoa"], { type: "text/plain" }), "test.txt");
      return req("POST", "/upload/file", { token: T, formData: fd });
    },
    70003,
    "FILE_TYPE_NOT_ALLOWED"
  );
  await test(
    "POST /upload/file 大小超限（11MB > 10MB）",
    async () => {
      const fd = new FormData();
      fd.append("file", new Blob([new Uint8Array(11 * 1024 * 1024)], { type: "image/png" }), "big.png");
      return req("POST", "/upload/file", { token: T, formData: fd });
    },
    70002,
    "FILE_TOO_LARGE"
  );

  // ================= 8. 操作日志 =================
  console.log("\n── 8. 操作日志（RBAC 拦截验证） ──");
  await test(
    "GET /operate-log/list",
    async () => {
      return req("GET", "/operate-log/list", { token: T });
    },
    10104,
    "admin 无 adminCenter:log:list 权限，预期拦截"
  );

  // ================= 9. 通知模块 =================
  console.log("\n── 9. 通知模块 ──");
  let notiId = 0;
  await test("POST /notification/create 创建通知", async () => {
    const r = await req("POST", "/notification/create", {
      token: T,
      body: { title: "测试通知", content: "全量测试自动创建", type: "system" },
    });
    notiId = r.data?.id || 0;
    return r;
  }, 200);
  await test("GET /notification/list 列表", async () => {
    return req("GET", "/notification/list", { token: T });
  }, 200);
  await test("GET /notification/unread-count 未读数", async () => {
    return req("GET", "/notification/unread-count", { token: T });
  }, 200);
  await test("POST /notification/read/{id} 标记已读", async () => {
    return req("POST", `/notification/read/${notiId || 1}`, { token: T });
  }, 200);
  await test("POST /notification/read-all 全部已读", async () => {
    return req("POST", "/notification/read-all", { token: T });
  }, 200);

  // ================= 10. 数据字典 =================
  console.log("\n── 10. 数据字典 ──");
  const typeCode = `t_${TS}`;
  let dictTypeId = 0;
  let dictDataId = 0;
  await test("GET /dict/all 全部字典（公开）", async () => {
    return req("GET", "/dict/all");
  }, 200);
  await test("POST /dict/type 创建字典类型", async () => {
    const r = await req("POST", "/dict/type", {
      token: T,
      body: { typeCode, typeName: "测试字典", remark: "全量测试" },
    });
    dictTypeId = r.data?.id || 0;
    return r;
  }, 200);
  await test("GET /dict/type/{typeCode} 按类型查（公开）", async () => {
    return req("GET", `/dict/type/${typeCode}`);
  }, 200);
  await test("GET /dict/admin/types 管理端类型列表（含停用）", async () => {
    return req("GET", "/dict/admin/types?page=1&pageSize=10", { token: T });
  }, 200);
  await test("POST /dict/data 创建字典项", async () => {
    const r = await req("POST", "/dict/data", {
      token: T,
      body: { dictTypeId, label: "选项一", value: "opt1", sort: 1 },
    });
    dictDataId = r.data?.id || 0;
    return r;
  }, 200);
  await test("PUT /dict/type/{id} 更新类型", async () => {
    return req("PUT", `/dict/type/${dictTypeId || 1}`, { token: T, body: { typeName: "测试字典-改" } });
  }, 200);
  await test("PUT /dict/data/{id} 更新字典项", async () => {
    return req("PUT", `/dict/data/${dictDataId || 1}`, { token: T, body: { label: "选项一-改" } });
  }, 200);
  await test("GET /dict/admin/data 管理端字典项列表（含停用）", async () => {
    return req("GET", `/dict/admin/data?typeId=${dictTypeId || 1}&page=1&pageSize=10`, { token: T });
  }, 200);
  await test("DELETE /dict/data/{id} 删除字典项（清理）", async () => {
    return req("DELETE", `/dict/data/${dictDataId || 1}`, { token: T });
  }, 200);
  await test("DELETE /dict/type/{id} 删除字典类型（清理）", async () => {
    return req("DELETE", `/dict/type/${dictTypeId || 1}`, { token: T });
  }, 200);

  // ================= 12. 系统配置（RBAC 拦截验证） =================
  console.log("\n── 12. 系统配置（RBAC 拦截验证） ──");
  await test(
    "GET /config/all",
    async () => {
      return req("GET", "/config/all", { token: T });
    },
    10104,
    "admin 无 systemSettings:config:list 权限，预期拦截"
  );
  await test(
    "PUT /config 更新配置",
    async () => {
      return req("PUT", "/config", { token: T, body: { key: "site_name", value: "测试" } });
    },
    10104,
    "admin 无 systemSettings:config:update 权限，预期拦截"
  );

  // ================= 13. 真实登录闭环 + refresh 成功 =================
  // dev 环境验证码接口返回明文答案（devCode），可走完整 captcha→login 链路
  if (!IS_PROD) {
    console.log("\n── 13. 登录闭环（验证码→登录→刷新） ──");
    let loginRefreshToken = "";
    await test(
      "POST /auth/login 完整链路（正确验证码+密码）",
      async () => {
        const cap = await req("GET", "/captcha");
        const r = await req("POST", "/auth/login", {
          body: {
            username: "admin",
            password: process.env.ADMIN_PASSWORD || "123456",
            captchaId: cap.data?.captchaId,
            captchaCode: cap.data?.devCode,
          },
        });
        loginRefreshToken = r.data?.refreshToken || "";
        return r;
      },
      200,
      "CAPTCHA→LOGIN→双令牌"
    );
    await test(
      "POST /auth/refresh 真实 refreshToken 续期",
      async () => {
        return req("POST", "/auth/refresh", { body: { refreshToken: loginRefreshToken } });
      },
      200,
      "刷新成功返回新 access token"
    );
    await test(
      "POST /auth/profile 用刷新后的新 token 获取用户",
      async () => {
        const ref = await req("POST", "/auth/refresh", { body: { refreshToken: loginRefreshToken } });
        return req("POST", "/auth/profile", { token: ref.data?.token || "" });
      },
      200,
      "新 token 可用"
    );
  } else {
    // 生产环境：captcha 不返回 devCode → 登录闭环无法自动化，改为验证直签鉴权链路可用
    console.log("\n── 13. 生产环境：登录闭环跳过（见组 15），直签鉴权冒烟 ──");
    await test(
      "POST /auth/profile 生产环境 JWT 直签鉴权可用",
      async () => {
        return req("POST", "/auth/profile", { token: T });
      },
      200,
      "access token 在生产环境校验通过"
    );
  }

  // ================= 14. 多角色 RBAC 差异 =================
  // operator/viewer 由 admin 创建并绑定角色，验证不同权限集合下的行为差异
  console.log("\n── 14. 多角色 RBAC（operator/viewer） ──");
  const opUser = `op_${TS}`;
  const vwUser = `viewer_${TS}`;
  let opId = 0;
  let vwId = 0;
  await test("POST /user 创建 operator 角色用户", async () => {
    const r = await req("POST", "/user", {
      token: T,
      body: { username: opUser, password: "Test@123456", realName: "操作员", roleCodes: ["operator"] },
    });
    opId = r.data?.id || 0;
    return r;
  }, 200);
  await test("POST /user 创建 viewer 角色用户", async () => {
    const r = await req("POST", "/user", {
      token: T,
      body: { username: vwUser, password: "Test@123456", realName: "只读", roleCodes: ["viewer"] },
    });
    vwId = r.data?.id || 0;
    return r;
  }, 200);
  await test(
    "GET /user/list operator 无 adminCenter:user:list 被拒",
    async () => {
      return req("GET", "/user/list", { token: signToken(opId || 2, opUser) });
    },
    10104,
    "operator 仅业务菜单，管理接口被拒"
  );
  await test(
    "POST /user viewer 无 adminCenter:user:create 被拒",
    async () => {
      return req("POST", "/user", {
        token: signToken(vwId || 3, vwUser),
        body: { username: `vw_try_${TS}`, password: "Test@123456" },
      });
    },
    10104,
    "viewer 只有 list 权限"
  );
  await test(
    "PUT /dict/type/1 viewer 无 superAdmin:dict:update 被拒",
    async () => {
      return req("PUT", "/dict/type/1", { token: signToken(vwId || 3, vwUser), body: { typeName: "越权尝试" } });
    },
    10104,
    "viewer 未绑定字典权限"
  );
  await test(
    "DELETE /user/{id} 清理 operator/viewer 测试用户",
    async () => {
      // 仅删除创建成功的用户（id>0），避免回退值误删真实数据
      const ids = [opId, vwId].filter((x) => x > 0);
      if (ids.length === 0) return { code: 200 };
      const results = await Promise.all(ids.map((id) => req("DELETE", `/user/${id}`, { token: T })));
      return { code: results.every((r) => r.code === 200) ? 200 : 10500 };
    },
    200,
    "数据清理"
  );

  // ================= 15. 生产环境专属断言（仅 NODE_ENV=production） =================
  if (IS_PROD) {
    console.log("\n── 15. 生产环境专属（Swagger / devCode / 堆栈） ──");
    await test(
      "GET /api-docs 生产环境返回 404",
      async () => {
        const r = await fetch(`http://localhost:${process.env.APP_PORT || 3000}/api-docs`, { method: "GET" });
        const json = await r.json().catch(() => ({}));
        return { code: json.code ?? (r.status === 404 ? 10404 : 10500) };
      },
      10404,
      "Swagger 仅开发环境挂载"
    );
    await test(
      "GET /captcha 生产环境不返回 devCode",
      async () => {
        const r = await req("GET", "/captcha");
        return { code: r.code === 200 && r.data && r.data.devCode === undefined ? 200 : r.code || 10500 };
      },
      200,
      "明文验证码仅限 dev 环境"
    );
    await test(
      "错误响应不携带堆栈",
      async () => {
        const r = await req("GET", "/user/999999", { token: T });
        const leakFree = r.code === 10002 && !("stack" in r) && !("stackTrace" in r);
        return { code: leakFree ? 200 : 10500 };
      },
      200,
      "生产环境不泄露调用栈"
    );
  }

  // ================= 汇总 =================
  console.log(`\n========== 结果汇总 ==========`);
  console.log(`✅ PASS: ${passed}   ❌ FAIL: ${failed}`);
  if (failures.length) {
    console.log(`失败用例：`);
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log("================================");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("测试程序异常：", e.message);
  process.exit(1);
});
```

#### RBAC验证

`root/test/verify-rbac.ts`为验证脚本：

```js
/**
 * ============================================================
 * RBAC 菜单/角色 临时验证脚本（test/verify-rbac.ts）
 * ------------------------------------------------------------
 * 用途：验证新增的 menu / role 模块核心链路（service 层直连）
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
  const hasMenuManage = JSON.stringify(allTree).includes("菜单管理");
  const hasRoleManage = JSON.stringify(allTree).includes("角色管理");
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
    check("admin 树含 系统管理", flat.includes("系统管理"));
    check("admin 树含 菜单管理", flat.includes("菜单管理"));
    check("admin 树含 角色管理", flat.includes("角色管理"));
    check("admin 树不含按钮(纯 DIR/MENU)", !flat.includes("superAdmin:menu:create"));
    console.log(`     根节点数: ${adminTree.length}`);
  }

  // ---------- 3. viewer 受限树（祖先补全） ----------
  console.log("\n[3] viewer 受限菜单树");
  const viewerUser = await userService.create({
    username: `viewer_test_${Date.now()}`,
    password: "Test123456",
    realName: "验证用只读用户",
    roleCodes: ["viewer"]
  });
  check("创建 viewer 用户成功", !!viewerUser?.id);
  if (viewerUser?.id) {
    const viewerTree = await menuService.getTreeByUser(viewerUser.id);
    const flat = JSON.stringify(viewerTree);
    check("viewer 树含 用户管理", flat.includes("用户管理"));
    check("viewer 树不含 菜单管理", !flat.includes("菜单管理"));
    check("viewer 树不含 角色管理", !flat.includes("角色管理"));
    // 祖先补全：用户管理 的父目录 系统管理 应被纳入
    check("viewer 树祖先补全(含 系统管理)", flat.includes("系统管理"));
    // 清理 viewer 用户
    await userService.delete(viewerUser.id);
    console.log("     已清理 viewer 测试用户");
  }

  // ---------- 4. 菜单 CRUD ----------
  console.log("\n[4] menuService CRUD");
  const menu = await menuService.create({
    name: "验证菜单",
    type: "MENU",
    path: "/system/verify",
    permission: "system:verify:list",
    sort: 99
  });
  check("创建菜单成功", !!menu?.id);
  if (menu?.id) {
    const updated = await menuService.update(menu.id, { name: "验证菜单-改", sort: 98 });
    check("更新菜单成功", updated?.name === "验证菜单-改");
    // 同级重名应报 MENU_EXIST
    let dupRejected = false;
    try {
      await menuService.create({ name: "验证菜单-改", type: "MENU" });
    } catch (e: any) {
      dupRejected = e?.message === "MENU_EXIST";
    }
    check("同级重名被拦截(MENU_EXIST)", dupRejected);
    // 有子菜单应拒绝删除
    const child = await menuService.create({
      parentId: menu.id,
      name: "验证子菜单",
      type: "BUTTON",
      permission: "system:verify:btn"
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
    check("菜单删除成功(含子清理)", true);
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

  // ---------- 6. 角色被用户引用时拒绝删除 ----------
  console.log("\n[6] 角色占用保护");
  const tmpRole = await roleService.create({ code: `inuse_role_${Date.now()}`, name: "占用验证角色" });
  const tmpUser = tmpRole?.id
    ? await userService.create({ username: `inuse_${Date.now()}`, password: "Test123456", roleCodes: [roleCode] })
    : null;
  if (tmpRole?.id) {
    // 把刚创建的临时角色手动绑定给一个用户再删
    const bindUser = await userService.create({ username: `bind_${Date.now()}`, password: "Test123456" });
    if (bindUser?.id) {
      await prisma.userRole.create({ data: { userId: bindUser.id, roleId: tmpRole.id } });
      let rejected = false;
      try {
        await roleService.delete(tmpRole.id);
      } catch (e: any) {
        rejected = e?.message === "ROLE_IN_USE";
      }
      check("被用户引用的角色拒绝删除(ROLE_IN_USE)", rejected);
      await userService.delete(bindUser.id);
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
```

#### 自动测试

```bash
npm run test
```

`test/api-full-test.cjs` 全量冒烟测试：

- `dev`环境（`NODE_ENV` 默认）：`58` 用例 / `58 PASS`
  - 覆盖全部 28 个接口路径的正常/异常/权限分支
  - 真实登录闭环（`captcha` → `login` → `refresh` 续期）
  - 多角色 RBAC 差异（ `operator` / `viewer`）
  - 上传类型与大小拒收（`text/plain`、`11MB`）
- `prod` 环境（`NODE_ENV=production`）：`59 `用例 / `59 PASS`
  - 追加生产专属断言：`Swagger` 关闭 `404`、`captcha` 不返回 `devCode`、错误响应不泄露堆栈
  - 登录闭环自动跳过（生产无 `devCodes`，属预期）

```bash
# 生产环境跑测（需先以 NODE_ENV=production 启动服务）
$env:NODE_ENV="production"; npm start      # 终端 1
$env:NODE_ENV="production"; npm test       # 终端 2
```

```bash
npm run verify:rbac
```

`test/verify-rbac.ts` 验证 menu / role 模块核心链路（`service `层直连）

```bash
npm run verify:ops
```

`test/verify-ops.ts` 验证运维中心四组能力（健康检查 / 会话中心 / 运行指标 / 运维任务 / 知识库文档，`service` 层直连，16 项断言）

## 快速开始

### 核心步骤

```bash
# 1. 复制模板 → 改名（模板目录保持不动，新项目独立一份）
#    复制后保留 node_modules（依赖相同），或删掉重新 npm install

# 2. 改 .env（必改项）
#    APP_PORT=xxxx        # 换成项目端口，避免多服务冲突
#    JWT_SECRET=...       # 换成 ≥32 位随机串（安全底线）
#    DB_TYPE=sqlite       # 开发默认；切 MySQL 时改 DB_TYPE + DATABASE_URL

# 3. 初始化数据库 / 帮助文件
npm run db:rebuild
#    内部自动：prisma generate → migrate deploy（建 13 张表）→ db:seed（灌 admin + 角色 + 菜单）
#    不做这步：库里没 admin 账号、没菜单权限，登录不了、权限全空
npm run help:index
#    或调 `POST /api/v1/help/admin/reindex`（登录即可），自动生成数据检索

# 4. 启动
npm run dev        # 自动生成 tsoa 路由 + 起服务（默认 admin/123456）

# 5. 开发新业务模块
#    ① prisma/schema.prisma 加模型 → npx prisma migrate dev --name xxx
#    ② src/modules/xxx/ 写 controller + service + schema（Joi）
#    ③ npm run dev（自动重新生成路由/Swagger）→ 验收
```

> 1. `npm run db:rebuild` 是"一键操作系统"：自动执行 `prisma generate`（生成 Client）→ `migrate deploy`（建 13 张表）→ `db:seed`（灌 RBAC 种子数据）
> 2. 全新克隆仓库后只需 `npm install` + 这一条命令即可就绪

启动后：

- API 文档：http://localhost:3000/api-docs
- 健康检查：http://localhost:3000/
- 默认管理员：`administrator / 123456`（email：`administrator@example.com`，首次登录后请尽快修改）

### 详细步骤

1. **获取代码**：`git clone` 项目到本地并修改项目名称

2. **项目配置**：复制 `.env.example` 为 `.env`（`.env.example` 是说明书，不参与运行）

   ```bash
   #    APP_PORT=xxxx        # 换成项目端口，避免多服务冲突
   #    JWT_SECRET=...       # 换成 ≥32 位随机串（安全底线）
   #    DB_TYPE=sqlite       # 开发默认；切 MySQL 时改 DB_TYPE + DATABASE_URL
   ```

   默认 `DB_TYPE=sqlite` 时无需安装数据库即可启动；`DB_TYPE=mysql` 需要先建库并导入 `sql/` 下建表 `SQL`

3. **安装依赖**：`npm install`

> 若安装失败，请`Remove-Item -Recurse -Force node_modules`然后`npm install better-sqlite3 --sqlite3_binary_host_mirror=https://github.com/WiseLibs/better-sqlite3/releases/download`

1. **数据初始：**
   - `npm run db:rebuild`一键初始化数据库（`generate + 建表 + seed，一步到位`）
   - `npm run help:index` 一键初始化帮助中心文档

2. **启动服务**：`npm run dev`

   > 1. `dev` 内部依次执行：`tsoa spec-and-routes`（生成路由和文档）→ `kill-port 3000`（清端口）→ `dotenvInit`（自动检测并写入 `LOCAL_IP`）→ `nodemon --exec tsx app.ts`（热重载启动）
   > 2. 重新安装依赖时，启动前运行`npm run db:generate`

3. **模式差异：**

| DB_TYPE  | 需要准备                    | 首次启动                                                  |
| -------- | --------------------------- | --------------------------------------------------------- |
| `sqlite` | 无                          | 自动创建数据库文件（`data/` 下 `.db` 文件），业务表手动建 |
| `mysql`  | 建库 + 导入 `sql/` 建表 SQL | 连接池自动连接                                            |

### 操作速查

| 场景           | 命令                 | 说明                                           |
| -------------- | -------------------- | ---------------------------------------------- |
| **全新初始化** | `npm run db:rebuild` | 删库→建表→seed 一步完成（含 generate）         |
| **开发启动**   | `npm run dev`        | tsoa 生成路由 + nodemon 热重载                 |
| **生产启动**   | `npm run start`      | tsoa 生成路由 + tsx 直接运行                   |
| **全量测试**   | `npm test`           | 冒烟测试：dev 环境 49 用例 / prod 环境 50 用例 |
| **删库重装**   | `npm run db:rebuild` | 会清空全部数据！执行前先停服务                 |
| **类型检查**   | `npx tsc --noEmit`   | 全量类型检查（不产出 dist）                    |

> ⚠️ **危险命令**：`db:rebuild` 会清空当前数据库全部数据，仅用于全新初始化或确认要重置的场景；日常开发不要执行。

## 目录架构

```
express-prisma-tsoa/
├── app.ts                    # 入口：全局中间件 + 路由挂载 + 启动
├── prisma.config.ts          # Prisma 7 CLI 配置（schema / migrations / seed）
├── prisma/
│   ├── schema.prisma         # 全部数据模型（单文件即文档）
│   ├── seed.ts               # RBAC 种子数据（角色/菜单/管理员）
│   └── migrations/           # 数据库迁移（版本化管理）
├── routes/healthRouter.ts    # 健康检查（探活）
├── scripts/
│   ├── rebuild-db.cjs        # 一键重装数据库（删库，供 db:rebuild 调用）
│   └── backup.ts             # 数据备份脚本（MySQL 场景启用）
├── test/api-full-test.cjs    # 全量 API 冒烟测试（49/50 用例）
├── test/verify-rbac.ts       # RBAC 菜单/角色验证（service 层直连）
├── test/verify-ops.ts        # 运维中心四组能力验证（service 层直连）
└── src/
    ├── bootstrap.ts          # 启动流程 + 优雅关闭
    ├── base/BaseController.ts        # Controller 基类
    ├── config/               # env.schema(zod) + app/db/jwt/upload/swagger
    ├── constants/            # errorCode / errorMap / messageCode / role / statusCode
    ├── db/prisma.ts          # Prisma 客户端单例（二态 Driver Adapter）
    ├── middleware/           # auth / cors / error / logger / metrics / rateLimit / response / upload / operateLog
    ├── modules/              # auth / captcha / config / dict / health / help / menu / metrics / notification / operateLog / opsTask / role / session / upload / user
    ├── utils/                # jwt / password / logger(pino) / logRotate / dbBackup / menuTree / tokenHash / date / file
    └── types/                # express.d.ts 类型扩展
```

## 开关程序

### 启动服务

在`src/bootstrap.ts`中定义了项目核心模块的初始化程序和启动核心工作：

```ts
/**
 * ============================================================
 * 服务启动引导（bootstrap.ts）
 * ------------------------------------------------------------
 * 统一管理服务启动与优雅关闭流程：
 *   1. 初始化数据库（Prisma 连接 + mock 不需要了，这里做连接校验）
 *   2. 启动 HTTP 服务
 *   3. 注册优雅关闭：SIGTERM / SIGINT → 停止接收新连接 →
 *      等待在途请求完成（超时兜底）→ 关闭 Prisma → 退出
 *
 * 以后加新的初始化步骤，直接在 initSteps 数组里加就行
 * ============================================================
 */

import { Application } from "express";
import os from "os";
import appConfig from "@src/config/app.config";
import { prisma } from "@src/db/prisma";

/** 现场检测本机局域网 IP（bootstrap 兜底：LOCAL_IP 未写入 .env 时也能显示） */
function detectLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

/** 初始化步骤列表（按顺序执行，可扩展） */
const initSteps: { name: string; run: () => Promise<void> }[] = [
  {
    name: "Database",
    run: async () => {
      // 校验数据库连接（DB_TYPE 由 .env 控制，连接串在 db/prisma.ts 注入）
      await prisma.$queryRaw`SELECT 1`;
    },
  },
];

/**
 * 启动服务
 * @param app Express 实例
 */
export async function bootstrap(app: Application): Promise<void> {
  const PORT = appConfig.port;
  const HOST = appConfig.host;

  console.log("\n🚀 Server is starting...\n");

  // ---------- 1. 依次执行初始化步骤 ----------
  for (const step of initSteps) {
    console.log(`Init ${step.name}...`);
    await step.run();
  }

  // ---------- 2. 启动 HTTP 服务 ----------
  const server = app.listen(PORT, HOST, () => {
    // 展示地址优化：监听 0.0.0.0（允许局域网/容器访问）时，
    // 本地访问显示 localhost，局域网访问显示 LOCAL_IP（npm run init 自动写入）
    const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
    // 优先用 .env 的 LOCAL_IP（npm run init 写入）；未写入时现场检测兜底
    const localIP = process.env.LOCAL_IP || detectLocalIP();
    const lanAddress = localIP && localIP !== "127.0.0.1" ? `http://${localIP}:${PORT}` : null;

    console.log("\n========================================");
    console.log(`✅ Server is running...`);
    console.log(`⚾️ Local: http://${displayHost}:${PORT}`);
    if (lanAddress) console.log(`🌐 WLAN: ${lanAddress}(LAN Devices are Accessible)`);
    console.log(`📖 API Docs: http://${displayHost}:${PORT}/api-docs`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🗄️  Database: ${process.env.DB_TYPE || "sqlite"}`);
    console.log("========================================\n");
  });

  // ---------- 3. 注册优雅关闭 ----------
  // 用途：部署平台（PM2 / Docker / k8s）发来终止信号时，
  //       不再接收新请求、等待在途请求处理完、关闭数据库连接，避免脏数据
  const GRACE_TIMEOUT = 10_000; // 等待在途请求的最大秒数（毫秒）

  const shutdown = (signal: string) => {
    console.log(`\n⏹️  Received ${signal}, shutting down gracefully...`);

    // 1. 停止接收新连接
    server.close(() => {
      console.log("✅ HTTP server closed");
    });

    // 2. 等待在途请求完成（超时兜底强杀）
    const timer = setTimeout(async () => {
      console.warn("⏰ Grace period expired, forcing exit...");
      await prisma.$disconnect();
      process.exit(1);
    }, GRACE_TIMEOUT);
    timer.unref(); // 不阻塞事件循环

    // 3. 正常路径：server.close 回调里关闭数据库并退出
    //    （用 close 事件 + 计数保证在所有连接结束后执行）
    let isClosed = false;
    server.on("close", async () => {
      if (isClosed) return;
      isClosed = true;
      clearTimeout(timer);
      await prisma.$disconnect();
      console.log("✅ Database disconnected");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM")); // PM2 / Docker stop
  process.on("SIGINT", () => shutdown("SIGINT")); // Ctrl+C / nodemon 重启
}
```

### 启动程序

根目录下的`app.ts`框架代码如下：

```ts
/**
 * ============================================================
 * 应用入口文件（app.ts）
 * ------------------------------------------------------------
 * 职责：
 *   1. 加载环境变量与路径别名（必须最先执行）
 *   2. 注册全局中间件（安全头 / 跨域 / 解析请求体 / 统一响应 / 日志 / 限流）
 *   3. 挂载静态资源目录
 *   4. 开发环境挂载 API 文档（TSOA 自动生成的 OpenAPI 3.0 文档）
 *   5. 注册业务路由（/api/v1 版本前缀）与 404 / 全局错误处理
 *   6. 创建 HTTP 服务并启动（优雅关闭在 bootstrap 中处理）
 * ============================================================
 */

// ---------- 1. 加载顺序敏感：必须在所有 import 之前 ----------
// 路径别名注册（@routes、@src、@root、@public），见 package.json 的 _moduleAliases
import "module-alias/register";

// 加载 .env 环境变量，并展开其中的变量引用
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
dotenvExpand.expand(dotenv.config());

// ---------- 2. 引入依赖与配置 ----------
import express, { Application } from "express";
import path from "path";
import helmet from "helmet";

import appConfig from "@src/config/app.config";

// ---------- 3. 引入中间件 ----------
import corsMiddleware from "@src/middleware/cors.middleware";
import responseMiddleware from "@src/middleware/response.middleware";
import loggerMiddleware from "@src/middleware/logger.middleware";
import { rateLimitMiddleware, loginRateLimitMiddleware } from "@src/middleware/rateLimit.middleware";
import { operateLogMiddleware } from "@src/middleware/operateLog.middleware";
import { errorHandler, notFoundHandler } from "@src/middleware/error.middleware";
// 自定义 multer（带文件类型/大小过滤），传给 RegisterRoutes 覆盖 TSOA 默认裸 multer
import { upload as uploadMiddleware } from "@src/middleware/upload.middleware";

// ---------- 4. 引入路由 ----------
// 健康检查路由
import healthRouter from "@routes/healthRouter";
// TSOA 自动生成的业务路由（先跑 npm run tsoa 生成）
import { RegisterRoutes } from "@src/routes/routes";

// ---------- 5. 创建 Express 应用 ----------
const app: Application = express();

// ---------- 6. 注册全局中间件（顺序敏感） ----------
app.use(helmet()); // 安全响应头（X-Frame-Options、CSP 等）
app.use(corsMiddleware); // 跨域
app.use(express.json()); // 解析 JSON 请求体
app.use(express.urlencoded({ extended: true }));
app.use(responseMiddleware); // 统一响应 res.success / res.error
app.use(loggerMiddleware); // Pino 结构化请求日志
app.use(rateLimitMiddleware); // 全局基础限流

// ---------- 7. 静态资源目录 ----------
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------- 8. Swagger API 文档（仅开发环境启用，TSOA 自动生成） ----------
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const swaggerUi = require("swagger-ui-express");
  // TSOA 生成的 swagger.json（先跑 npm run tsoa 生成）
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const swaggerSpecs = require("./src/swagger/swagger.json");

  // 合并全局说明文档（配置在 src/config/swagger.ts）
  // 注意：必须用 Object.assign 合并，不能整体赋值——
  // 整体赋值会把 tsoa 生成的 info.title / info.version 抹掉
  const { swaggerInfo } = require("./src/config/swagger");
  Object.assign(swaggerSpecs.info, swaggerInfo);

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
  console.log(`📖 API Docs: http://localhost:${appConfig.port}/api-docs`);
}

// ---------- 9. 注册业务路由（/api/v1 版本前缀） ----------
app.use("/", healthRouter); // 健康检查（无版本前缀，供探活）
// 登录/验证码敏感接口严格限流：只防爆破，不牵连 register/profile/refresh/logout 等
// 正常业务（避免一小时内测试/多设备登录被误伤）；全局接口仍受上方基础限流 300/15min
app.post("/api/v1/auth/login", loginRateLimitMiddleware);
app.get("/api/v1/captcha", loginRateLimitMiddleware);
app.use(operateLogMiddleware); // 操作日志中间件：自动记录写操作
// 传入自定义 multer：TSOA 默认 multer 只有 8MB 大小限制、无类型过滤，
// 覆盖后上传类型（allowedTypes）与大小（MAX_FILE_SIZE）限制才真正生效
RegisterRoutes(app, { multer: uploadMiddleware }); // TSOA 自动生成的业务路由（controller 内 @Route 已带 api/v1 前缀）

// ---------- 10. 404 与全局错误处理（必须在所有路由之后） ----------
app.use(notFoundHandler);
app.use(errorHandler);

// ---------- 11. 启动服务（优雅关闭在 bootstrap 中处理） ----------
import { bootstrap } from "@src/bootstrap";
bootstrap(app).catch((err) => {
  console.error("❌ Server Started Fail:", err);
  process.exit(1);
});

export default app;
```

### 优雅关闭

监听 `SIGTERM` / `SIGINT`：

1. 停止接收新连接
2. 等待在途请求完成（10s 超时兜底强杀）
3. 关闭 Prisma 连接
4. 退出进程

配合 `PM2 / Docker / k8s` 滚动更新不丢请求。

## 环境变量

`.env.example`为环境变量范例：

```env
# ============================================================
# 环境变量示例文件（.env.example）
# 用法：复制本文件为 .env，按需修改后生效
# 注意：.env 不提交 git，本文件是模板说明
# ============================================================

# -------------------- 应用配置 --------------------
# 运行环境：development / production
NODE_ENV=development
# 服务监听端口
APP_PORT=3000
# 监听地址，0.0.0.0 允许局域网访问
APP_HOST=0.0.0.0
# 本机局域网 IP（npm run init 自动检测写入，留空即可；用于启动时展示局域网访问地址）
LOCAL_IP=

# -------------------- 数据库配置 --------------------
# 数据库模式：mysql / sqlite（二态）
#   sqlite - Prisma + sqlite 文件库，零配置开箱即用（默认）
#   mysql  - Prisma + MySQL，需先建库，并把 schema.prisma 的
#            provider 改为 "mysql" 后重新 prisma generate
DB_TYPE=sqlite
# Prisma 连接串（与 DB_TYPE 对应）：
#   sqlite 模式：file:./data/app.db
#   mysql 模式：mysql://root:password@127.0.0.1:3306/db_name
DATABASE_URL="file:./data/app.db"

# -------------------- 默认管理员账号（seed 用） --------------------
ADMIN_USERNAME=administrator
ADMIN_PASSWORD=123456

# -------------------- JWT 鉴权 --------------------
# 【生产环境必须修改】至少 32 位随机字符串
JWT_SECRET=change-me-in-production-0123456789abcdef
# Access Token 有效期（短，建议 15m）
JWT_EXPIRES_IN=15m
# Refresh Token 有效期（长，建议 7d）
JWT_REFRESH_EXPIRES_IN=7d

# -------------------- 安全配置 --------------------
# 登录失败锁定：连续失败 N 次锁定（分钟）
LOGIN_MAX_FAILURES=5
LOGIN_LOCK_MINUTES=15

# -------------------- 文件上传 --------------------
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# -------------------- 限流配置 --------------------
# 全局基础限流：每 IP 每窗口最大请求数 / 窗口分钟
RATE_LIMIT_MAX=300
RATE_LIMIT_WINDOW_MIN=15
# 登录等敏感接口更严格：每 IP 每窗口最大请求数 / 窗口分钟
LOGIN_RATE_LIMIT_MAX=10
LOGIN_RATE_LIMIT_WINDOW_MIN=1

# -------------------- 日志配置 --------------------
# 是否打印控制台：true=控制台+文件，false=仅写文件 logs/app.log
LOG_CONSOLE=true
# 单文件大小上限（MB），超过阈值自动轮转为 logs/app-YYYYMMDD-HHMMSSmmm.log
LOG_MAX_SIZE_MB=10
# 历史日志保留份数（不含当前 app.log），按时间戳只保留最新 N 份
LOG_MAX_FILES=7

# -------------------- 数据备份 --------------------
# 备份保留份数
BACKUP_KEEP=7
```

## 常量定义

### 代码映射

`src/constants/errorMap.ts`为错误码映射，用于后端错误处理中间件通过映射关系识别出真实的错误代码：

```ts
/**
 * ============================================================
 * 全局错误标识映射总表（constants/errorMap.ts）
 * ------------------------------------------------------------
 * 汇总所有模块的错误映射，给 error.middleware 使用
 * 加新模块只需要在这里展开一下 XXX_ERROR_MAP 即可
 *
 * 使用：error.middleware 识别 `throw`
 * ============================================================
 */

import { GLOBAL_ERROR_MAP } from "./errorCode";

/** 错误标识 → 数字码 总映射表 */
export const ERROR_MAP: Record<string, number> = {
  // 全局通用错误
  ...GLOBAL_ERROR_MAP,
};
```

### 错误代码

`src/constants/errorCode.ts`为错误码常量：

```ts
/**
 * ============================================================
 * 错误码常量（constants/errorCode.ts）
 * ------------------------------------------------------------
 * 后端只返回 code + 英文标识，前端按 code 映射多语言文案
 * 编码规则：
 *   200    - 成功
 *   10xxx  - 通用错误（参数、鉴权、验证码、系统）
 *   20xxx  - 认证 / 用户模块
 *   70xxx  - 文件上传
 *   80xxx  - 示例 / 演示模块
 * 使用：error 中间件、controller
 * ============================================================
 */

export const ERROR_CODE = {
  // ==================== 成功 ====================
  SUCCESS: 200,

  // ==================== 通用错误 10xxx ====================
  PARAM_ERROR: 10001, // 参数错误
  PARAM_MISSING: 10002, // 缺少必填参数
  PARAM_INVALID: 10003, // 参数格式非法

  // -------------------- 鉴权错误 --------------------
  UNAUTHORIZED: 10101, // 未登录 / 未授权
  TOKEN_EXPIRED: 10102, // Token 已过期
  TOKEN_INVALID: 10103, // Token 无效
  PERMISSION_DENIED: 10104, // 权限不足
  ACCOUNT_LOCKED: 10105, // 账号已锁定
  TOO_MANY_REQUESTS: 10106, // 请求过于频繁

  // -------------------- 验证码错误 --------------------
  CAPTCHA_EXPIRED: 10201, // 验证码已过期
  CAPTCHA_ERROR: 10202, // 验证码错误

  // -------------------- 资源不存在 --------------------
  NOT_FOUND: 10404, // 接口 / 资源不存在

  // -------------------- 系统错误 --------------------
  SYSTEM_ERROR: 10500, // 服务器内部错误
  DATABASE_ERROR: 10501, // 数据库操作异常
  NETWORK_ERROR: 10502, // 网络异常
  UNKNOWN_ERROR: 10999, // 未知错误

  // ==================== 认证 / 用户模块 20xxx ====================
  USER_NOT_EXIST: 20001, // 用户不存在
  USER_ALREADY_EXIST: 20002, // 用户已存在
  USER_PASSWORD_ERROR: 20003, // 密码错误
  USER_DISABLED: 20004, // 账号已被禁用
  PASSWORD_WEAK: 20005, // 密码强度不足
  USER_SELF_OPERATION_FORBIDDEN: 20006, // 禁止操作自己（删除/禁用）
  ADMIN_LAST_PROTECTED: 20007, // 最后一个管理员不可删除/禁用/降级
  SUPER_ADMIN_PROTECTED: 20008, // 超级管理员账号受保护，禁止操作（隐藏账号）
  PASSWORD_RESET_CODE_INVALID: 20009, // 重置密码验证码错误或已过期
  PASSWORD_RESET_TOO_MANY_ATTEMPTS: 20010, // 重置密码验证码尝试次数过多
  USER_ROLE_LEVEL_FORBIDDEN: 20011, // 无权操作同级或更高级别的用户/角色
  PASSWORD_RESET_ACCOUNT_NOT_FOUND: 20012, // 用户名与邮箱不匹配
  REGISTER_DISABLED: 20013, // 自助注册功能已关闭
  PASSWORD_SAME_AS_OLD: 20014, // 新密码不能与旧密码相同
  PASSWORD_CHANGE_REQUIRED: 20015, // 请先修改初始密码
  USER_PENDING_APPROVAL: 20016, // 自助注册账号待管理员审核
  USER_NOT_PENDING_APPROVAL: 20017, // 账号不在待审核状态，无法执行审核操作

  // ==================== 数据字典 30xxx ====================
  DICT_TYPE_NOT_FOUND: 30001, // 字典类型不存在
  DICT_TYPE_EXIST: 30002, // 字典类型已存在
  DICT_DATA_NOT_FOUND: 30003, // 字典项不存在

  // ==================== 菜单 / 角色（RBAC）40xxx ====================
  MENU_NOT_FOUND: 40001, // 菜单不存在
  MENU_HAS_CHILDREN: 40002, // 存在子菜单，无法删除
  MENU_EXIST: 40006, // 同级菜单名称已存在
  ROLE_NOT_FOUND: 40003, // 角色不存在
  ROLE_CODE_EXIST: 40004, // 角色编码已存在
  ROLE_IN_USE: 40005, // 角色已被用户占用，无法删除
  ROLE_SYSTEM_PROTECTED: 40007, // 内置角色（admin/operator/viewer）禁止删除/停用
  MENU_PERMISSION_EXIST: 40008, // 菜单权限码已存在

  // ==================== 运维中心 60xxx ====================
  SESSION_NOT_FOUND: 60001, // 会话不存在
  SESSION_ALREADY_REVOKED: 60002, // 会话已失效（已吊销）
  TASK_NOT_FOUND: 60003, // 运维任务不存在
  TASK_RUNNING: 60004, // 任务正在执行
  TASK_CONFIRM_REQUIRED: 60005, // 危险任务缺少二次确认
  TASK_EXEC_FAILED: 60006, // 任务执行失败
  BACKUP_FAILED: 60007, // 数据库备份失败
  TASK_DANGER_ONLY: 60008, // 危险任务必须走专用接口

  // ==================== 文件上传 70xxx ====================
  FILE_NOT_EXIST: 70001, // 文件不存在
  FILE_TOO_LARGE: 70002, // 文件大小超出限制
  FILE_TYPE_NOT_ALLOWED: 70003, // 文件类型不允许
  FILE_UPLOAD_FAIL: 70004, // 文件上传失败

  // ==================== 示例模块 80xxx ====================
} as const;

/** 错误码类型 */
export type ErrorCodeType = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

/**
 * 全局错误标识映射表
 * 自动把 ERROR_CODE 的 key 映射成字符串 → 数字码
 * 用于 error.middleware 自动识别 throw new Error("XXX") 里的标识
 */
export const GLOBAL_ERROR_MAP: Record<string, number> = Object.fromEntries(Object.entries(ERROR_CODE).map(([key, code]) => [key, code]));

/**
 * 数字码 → 字符串标识 反向映射（自动从 ERROR_CODE 派生）
 * 用于 BaseController.fail() 未传 msg 时自动补全标识，
 * 保证 code 与 msg 永远一一对应，不会写错
 */
export const CODE_TO_MSG: Record<number, string> = Object.fromEntries(Object.entries(ERROR_CODE).map(([key, code]) => [code, key]));

/**
 * 错误码中文说明（与 ERROR_CODE 一一对应）
 * 供 Swagger 文档第 4 节动态生成表格；
 * 新增错误码时：在 ERROR_CODE 加一行 + 在这里补一行中文说明即可
 */
export const ERROR_DESC: Record<string, string> = {
  SUCCESS: "成功",
  PARAM_ERROR: "参数错误",
  PARAM_MISSING: "缺少必填参数",
  PARAM_INVALID: "参数格式非法",
  UNAUTHORIZED: "未登录 / 未授权",
  TOKEN_EXPIRED: "Token 已过期",
  TOKEN_INVALID: "Token 无效",
  PERMISSION_DENIED: "权限不足",
  ACCOUNT_LOCKED: "账号已锁定",
  TOO_MANY_REQUESTS: "请求过于频繁",
  CAPTCHA_EXPIRED: "验证码已过期",
  CAPTCHA_ERROR: "验证码错误",
  NOT_FOUND: "接口 / 资源不存在",
  SYSTEM_ERROR: "服务器内部错误",
  DATABASE_ERROR: "数据库操作异常",
  NETWORK_ERROR: "网络异常",
  UNKNOWN_ERROR: "未知错误",
  USER_NOT_EXIST: "用户不存在",
  USER_ALREADY_EXIST: "用户已存在",
  USER_PASSWORD_ERROR: "密码错误",
  USER_DISABLED: "账号已被禁用",
  PASSWORD_WEAK: "密码强度不足",
  USER_SELF_OPERATION_FORBIDDEN: "禁止操作自己",
  ADMIN_LAST_PROTECTED: "最后一个管理员不可删除/禁用/降级",
  SUPER_ADMIN_PROTECTED: "超级管理员账号受保护，禁止操作",
  PASSWORD_RESET_CODE_INVALID: "重置密码验证码错误或已过期",
  PASSWORD_RESET_TOO_MANY_ATTEMPTS: "重置密码验证码尝试次数过多",
  USER_ROLE_LEVEL_FORBIDDEN: "无权操作同级或更高级别的用户/角色",
  PASSWORD_RESET_ACCOUNT_NOT_FOUND: "用户名与邮箱不匹配",
  REGISTER_DISABLED: "自助注册功能已关闭",
  PASSWORD_SAME_AS_OLD: "新密码不能与旧密码相同",
  PASSWORD_CHANGE_REQUIRED: "请先修改初始密码",
  DICT_TYPE_NOT_FOUND: "字典类型不存在",
  DICT_TYPE_EXIST: "字典类型已存在",
  DICT_DATA_NOT_FOUND: "字典项不存在",
  MENU_NOT_FOUND: "菜单不存在",
  MENU_HAS_CHILDREN: "存在子菜单，无法删除",
  MENU_EXIST: "同级菜单名称已存在",
  ROLE_NOT_FOUND: "角色不存在",
  ROLE_CODE_EXIST: "角色编码已存在",
  ROLE_IN_USE: "角色已被用户占用，无法删除",
  ROLE_SYSTEM_PROTECTED: "内置角色禁止删除/停用",
  MENU_PERMISSION_EXIST: "菜单权限码已存在",
  SESSION_NOT_FOUND: "会话不存在",
  SESSION_ALREADY_REVOKED: "会话已失效",
  TASK_NOT_FOUND: "运维任务不存在",
  TASK_RUNNING: "任务正在执行",
  TASK_CONFIRM_REQUIRED: "危险任务缺少二次确认",
  TASK_EXEC_FAILED: "任务执行失败",
  BACKUP_FAILED: "数据库备份失败",
  TASK_DANGER_ONLY: "危险任务必须走专用接口",
  FILE_NOT_EXIST: "文件不存在",
  FILE_TOO_LARGE: "文件大小超出限制",
  FILE_TYPE_NOT_ALLOWED: "文件类型不允许",
  FILE_UPLOAD_FAIL: "文件上传失败",
};
```

### 业务状态

`src/constants/statusCode.ts`为通用业务状态枚举，只保留模板通用的枚举，业务模块的状态枚举需对应模块再加，所有枚举值严格与数据库字段定义对齐：

```ts
/**
 * ============================================================
 * HTTP 状态码常量（constants/statusCode.ts）
 * ------------------------------------------------------------
 * 统一 HTTP 状态码，避免魔法数字
 * 使用：response 中间件、限流
 * ============================================================
 */

export const STATUS_CODE = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
} as const;

export type StatusCodeType = (typeof STATUS_CODE)[keyof typeof STATUS_CODE];

/**
 * HTTP 状态码中文说明（与 STATUS_CODE 一一对应）
 * 供 Swagger 文档第 6 节动态生成表格；
 * 新增状态码时：在 STATUS_CODE 加一行 + 在这里补一行中文说明即可
 */
export const STATUS_DESC: Record<string, string> = {
  OK: "成功",
  CREATED: "已创建",
  NO_CONTENT: "无内容",
  BAD_REQUEST: "请求参数错误",
  UNAUTHORIZED: "未认证",
  FORBIDDEN: "禁止访问",
  NOT_FOUND: "资源不存在",
  TOO_MANY_REQUESTS: "请求过多",
  INTERNAL_ERROR: "服务器内部错误",
  BAD_GATEWAY: "网关错误",
};

export default STATUS_CODE;
```

### 消息代码

`src/constants/messageCode.ts`为除了错误代码之外的所有代码的汇总文件：

```ts
/**
 * ============================================================
 * 消息代码常量（constants/messageCode.ts）
 * ------------------------------------------------------------
 * 所有返回给前端的英文消息代码都在这里统一管理
 * 前端根据这些代码做国际化映射，不直接显示英文
 *
 * 命名规则：
 *   SUCCESS_XXX        → 成功类消息
 *   NOTIFICATION_XXX   → 通知类消息
 *
 * 使用：BaseController 默认 msg
 * ============================================================
 */

export const MESSAGE_CODE = {
  // ==================== 通用成功 ====================
  SUCCESS: "SUCCESS",

  // ==================== 认证模块 ====================
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  REGISTER_SUCCESS: "REGISTER_SUCCESS",
  LOGOUT_SUCCESS: "LOGOUT_SUCCESS",
  REFRESH_SUCCESS: "REFRESH_SUCCESS",

  // ==================== 通用 CRUD 成功 ====================
  CREATE_SUCCESS: "CREATE_SUCCESS",
  UPDATE_SUCCESS: "UPDATE_SUCCESS",
  DELETE_SUCCESS: "DELETE_SUCCESS",
  BATCH_DELETE_SUCCESS: "BATCH_DELETE_SUCCESS",

  // ==================== 文件上传 ====================
  UPLOAD_SUCCESS: "UPLOAD_SUCCESS",

  // ==================== 验证码 ====================
  CAPTCHA_GENERATED: "CAPTCHA_GENERATED",
} as const;

/** 消息代码类型 */
export type MessageCodeType = (typeof MESSAGE_CODE)[keyof typeof MESSAGE_CODE];

/**
 * 消息码中文说明（与 MESSAGE_CODE 一一对应）
 * 供 Swagger 文档第 5 节动态生成表格；
 * 新增消息码时：在 MESSAGE_CODE 加一行 + 在这里补一行中文说明即可
 */
export const MESSAGE_DESC: Record<string, string> = {
  SUCCESS: "通用成功",
  LOGIN_SUCCESS: "登录成功",
  REGISTER_SUCCESS: "注册成功",
  LOGOUT_SUCCESS: "退出成功",
  REFRESH_SUCCESS: "刷新成功",
  CREATE_SUCCESS: "创建成功",
  UPDATE_SUCCESS: "更新成功",
  DELETE_SUCCESS: "删除成功",
  BATCH_DELETE_SUCCESS: "批量删除成功",
  UPLOAD_SUCCESS: "上传成功",
  CAPTCHA_GENERATED: "验证码已生成",
};
```

### 用户角色

`src/constants/role.ts`为用户角色：常量代码，所有关于用户的全部在此进行定义，其他地方全部引用此处的常量：

```ts
/**
 * ============================================================
 * 角色常量（constants/role.ts）
 * ------------------------------------------------------------
 * 所有角色定义统一在这里，不要在代码里硬编码字符串
 * 注意：RBAC 后角色数据存库（roles 表），这里的常量用于
 *       seed 脚本、以及代码里引用角色 code 的场景
 *
 * 使用：RBAC 种子 / 权限
 * ============================================================
 */

export const ROLE = {
  /** 超级管理员：全部权限（含字典/角色/权限/菜单管理），隐藏账号，仅设计者维护 */
  SUPER_ADMIN: "superAdmin",

  /** 系统管理员：全部业务权限（四中心已收缩给 superAdmin） */
  ADMIN: "admin",

  /** 操作员：只能管业务，不能管用户/配置 */
  OPERATOR: "operator",

  /** 只读用户：只能看，不能改 */
  VIEWER: "viewer",
} as const;

/** 角色类型 */
export type RoleType = (typeof ROLE)[keyof typeof ROLE];

/**
 * 角色中文说明（与 ROLE 一一对应）
 * 供 Swagger 文档第 7 节动态生成表格；
 * 新增角色时：在 ROLE 加一行 + 在这里补一行中文说明即可
 */
export const ROLE_DESC: Record<string, string> = {
  SUPER_ADMIN: "超级管理员：全部权限（仅设计者维护）",
  ADMIN: "系统管理员：全部业务权限（不含字典/角色/权限/菜单管理）",
  OPERATOR: "操作员：只能管业务，不能管用户/配置",
  VIEWER: "只读用户：只能看，不能改",
};

/**
 * 角色层级：数字越大权限越高；自定义角色按 0 级处理
 */
export const ROLE_LEVEL: Record<string, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 50,
  OPERATOR: 20,
  VIEWER: 10,
};

export const DEFAULT_ROLE_LEVEL = 0;

export default ROLE;
```

## 基本配置

### 基类配置

在`tsoa`模式下，`TSOA` 版本所有 `Controller`继承此类，`src/base/BaseController.ts`：

```ts
/**
 * ============================================================
 * Controller 基类（base/BaseController.ts）
 * ------------------------------------------------------------
 * TSOA 版本所有 Controller 继承此类。
 *
 * ★ 重要（TSOA 运行时机制）：
 *   本 TSOA 版本不会把 Express 的 req / res 注入到 this.req / this.res。
 *   因此统一采用「return 模式」：
 *     1. 成功响应：方法里 return this.ok(data, msg)
 *     2. 参数校验失败：return this.failJoi(error)  —— Joi 错误统一转 PARAM_INVALID:字段名
 *     3. 主动失败：return this.fail(ERROR_CODE.XXX) —— msg 自动从 CODE_TO_MSG 补全，无需手写
 *     4. 业务错误：throw new Error("XXX")，由全局 errorHandler 处理
 *     5. 需要读取请求对象时：方法参数加 @Request() request: ExRequest
 *
 * ★ 国际化返回规范（本项目核心约定）：
 *   - 响应体固定 { code, msg, data, timestamp }
 *   - msg 永远是「字符串代码标识」（如 SUCCESS / USER_NOT_EXIST / PARAM_INVALID:username），
 *     前端拿 msg 做 i18n key 映射多语言，后端永不返回自然语言文案
 *   - code（数字）与 msg（标识）的双向映射集中维护在 constants/errorCode.ts，
 *     fail() 不传 msg 时自动补全，杜绝手写字符串散落与写错
 * ============================================================
 */

import { Controller } from "@tsoa/runtime";
import { ERROR_CODE, CODE_TO_MSG } from "../constants/errorCode";
import { MESSAGE_CODE } from "../constants/messageCode";
import { ApiResponse } from "../types";

export class BaseController extends Controller {
  /**
   * 成功响应构造器
   * 用法：return this.ok(result) 或 return this.ok(result, MESSAGE_CODE.CREATE_SUCCESS)
   * 不传 msg 时默认 SUCCESS
   */
  protected ok<T = any>(data: T, msg: string = MESSAGE_CODE.SUCCESS): ApiResponse<T> {
    return {
      code: ERROR_CODE.SUCCESS,
      msg,
      data,
      timestamp: Date.now(),
    };
  }

  /**
   * 失败响应构造器（参数校验等主动拦截场景）
   * 用法：return this.fail(ERROR_CODE.UNAUTHORIZED)
   * msg 不传时自动从 CODE_TO_MSG 反查标识（如 UNAUTHORIZED → "UNAUTHORIZED"），
   * 保证 code 与 msg 永远一致，且标识字符串只存在于 constants 一处
   */
  protected fail(code: number, msg?: string): ApiResponse<never> {
    return {
      code,
      msg: msg ?? CODE_TO_MSG[code] ?? "UNKNOWN_ERROR",
      data: null as never,
      timestamp: Date.now(),
    };
  }

  /**
   * Joi 参数校验失败统一出口
   * 用法：return this.failJoi(error)
   * 返回 PARAM_INVALID + 具体字段名（如 "PARAM_INVALID:username"），
   * 前端 i18n 用通配规则匹配「字段名」提示，不再透传 Joi 的英文原文
   */
  protected failJoi(error: { details?: Array<{ path?: Array<string | number> }> }): ApiResponse<never> {
    // 取第一个错误的字段路径（Joi 的 path 形如 ["username"]，嵌套形如 ["address","city"]）
    const field = error?.details?.[0]?.path?.join(".") ?? "param";
    return this.fail(ERROR_CODE.PARAM_INVALID, `PARAM_INVALID:${field}`);
  }
}
```

### 项目配置

`src/config/app.config.ts`为应用全局配置，所有配置从环境变量读取：

```ts
/**
 * ============================================================
 * 应用全局配置（config/app.config.ts）
 * ------------------------------------------------------------
 * 所有配置从 env.schema 读取（zod 已校验），不硬编码：
 *   - 端口 / 监听地址
 *   - 分页默认值
 *   - bcrypt 加密强度
 * ============================================================
 */

import env from "./env.schema";

/** 应用配置接口（TS 类型约束） */
export interface AppConfig {
  port: number;
  host: string;
  pagination: {
    defaultPage: number;
    defaultPageSize: number;
    maxPageSize: number;
  };
  bcrypt: {
    saltRounds: number;
  };
}

/** 组装应用配置 */
const appConfig: AppConfig = {
  port: env.APP_PORT,
  host: env.APP_HOST,

  pagination: {
    defaultPage: 1,
    defaultPageSize: 10,
    maxPageSize: 100,
  },

  bcrypt: {
    saltRounds: 10, // 安全与性能的平衡点
  },
};

export default appConfig;
```

### 数据配置

`src/config/db.config.ts`为数据库配置，支持2种模式，通过 .env 的 `DB_TYPE` 切换：

```ts
/**
 * ============================================================
 * 数据库配置（config/db.config.ts）
 * ------------------------------------------------------------
 * 支持两种模式，通过 .env 的 DB_TYPE 切换：
 *   - mysql  ：Prisma + MySQL
 *   - sqlite ：Prisma + SQLite 文件库（默认，零配置）
 *
 * 注意：Prisma 的 provider 在 schema.prisma 中声明，
 *       本文件只负责生成对应模式的连接信息供 db/prisma.ts 使用
 * ============================================================
 */

import env from "./env.schema";

/** 数据库类型枚举 */
export type DbType = "mysql" | "sqlite";

/** MySQL 连接配置 */
export interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/** 数据库总配置 */
export interface DbConfig {
  /** 当前数据库模式 */
  type: DbType;
  /** Prisma 连接串（直接来自 .env） */
  url: string;
  /** MySQL 配置（仅 type=mysql 时使用，从连接串解析） */
  mysql: MysqlConfig;
}

/** 从连接串解析 MySQL 各字段（mysql://user:pass@host:port/db） */
function parseMysqlUrl(url: string): MysqlConfig {
  const m = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!m) {
    // DATABASE_URL 不是合法的 MySQL 连接串: ${url}
    throw new Error(`DATABASEURL is Not a Valid, Database connection string: ${url}`);
  }
  return {
    user: m[1],
    password: m[2],
    host: m[3],
    port: Number(m[4]),
    database: m[5],
  };
}

/** 当前数据库类型（默认 sqlite，开箱即用） */
const dbType = (env.DB_TYPE || "sqlite") as DbType;

const dbConfig: DbConfig = {
  type: dbType,
  url: env.DATABASE_URL,
  mysql: dbType === "mysql" ? parseMysqlUrl(env.DATABASE_URL) : { host: "", port: 3306, user: "", password: "", database: "" },
};

export default dbConfig;
```

### 校验配置

加载 `.env` 环境变量并提供数据库模型校验，`src/config/env.schema.ts`：

```ts
/**
 * ============================================================
 * 环境变量 Schema 校验（config/env.schema.ts）
 * ------------------------------------------------------------
 * 职责：
 *   1. 用 zod 定义 .env 全部变量的类型与规则
 *   2. 启动时 parse 一次，变量缺失/类型错误立即 fail-fast
 *   3. 导出强类型配置对象，替代"手写 interface + 静默默认值"
 *
 * 用法：import { env } from "@src/config/env.schema";
 *       env.APP_PORT（带类型，不再是 string | undefined）
 *
 * ★ 重要：本文件内必须先加载 .env 再 parse。
 *   原因：本文件被其他模块 import 时立即执行 parse，
 *   若 dotenv 加载放在 app.ts（import 提升后），
 *   .env 尚未注入 process.env 就会报 undefined。
 *   因此 dotenv 加载必须在这里完成（唯一权威入口）。
 * ============================================================
 */

// 加载 .env 环境变量（必须最先执行，本文件是配置的唯一入口）
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
dotenvExpand.expand(dotenv.config());

import { z } from "zod";

/** 环境变量 Schema（所有配置的单一权威来源） */
const envSchema = z.object({
  // ---- 应用 ----
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_PORT: z.coerce.number().int().positive().default(3000),
  APP_HOST: z.string().default("0.0.0.0"),

  // ---- 数据库（二态） ----
  DB_TYPE: z.enum(["mysql", "sqlite"]).default("sqlite"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL 不能为空"),

  // ---- 默认管理员 ----
  ADMIN_USERNAME: z.string().default("administrator"),
  ADMIN_PASSWORD: z.string().default("123456"),

  // ---- JWT ----
  JWT_SECRET: z.string().min(32, "JWT_SECRET 至少 32 位，生产环境务必修改默认值"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // ---- 登录安全 ----
  LOGIN_MAX_FAILURES: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),

  // ---- 上传 ----
  UPLOAD_DIR: z.string().default("./uploads"),
  MAX_FILE_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),

  // ---- 限流 ----
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW_MIN: z.coerce.number().int().positive().default(15),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  LOGIN_RATE_LIMIT_WINDOW_MIN: z.coerce.number().int().positive().default(1),

  // ---- 日志 ----
  // 是否打印控制台：true=控制台+文件，false=仅写文件 logs/app.log
  LOG_CONSOLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  // 单文件大小上限（MB），超过即轮转为 app-时间戳.log
  LOG_MAX_SIZE_MB: z.coerce.number().int().positive().default(10),
  // 历史日志保留份数（不含当前 app.log）
  LOG_MAX_FILES: z.coerce.number().int().positive().default(7),

  // ---- 备份 ----
  BACKUP_KEEP: z.coerce.number().int().positive().default(7),
});

/** 解析并导出强类型环境变量（失败会抛错，服务不启动） */
export const env = envSchema.parse(process.env);

/** 环境变量类型（供其它文件引用） */
export type Env = z.infer<typeof envSchema>;

export default env;
```

### 鉴权配置

`src/config/jwt.config.ts`为`JWT`鉴权配置：

```ts
/**
 * ============================================================
 * JWT 配置（config/jwt.config.ts）
 * ------------------------------------------------------------
 * 双令牌机制：
 *   - Access Token：短期（默认 15m），请求鉴权用
 *   - Refresh Token：长期（默认 7d），刷新 access 用，存库可吊销
 * 密钥与过期时间从 env.schema 读取（zod 已校验 JWT_SECRET 长度）
 * ============================================================
 */

import env from "./env.schema";

export interface JwtConfig {
  /** 签名密钥（生产环境必须 >= 32 位随机串） */
  secret: string;
  /** Access Token 有效期 */
  expiresIn: string;
  /** Refresh Token 有效期 */
  refreshExpiresIn: string;
}

const jwtConfig: JwtConfig = {
  secret: env.JWT_SECRET,
  expiresIn: env.JWT_EXPIRES_IN,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
};

export default jwtConfig;
```

### OpenAPI

#### 基本概念

本模板`OpenAPI`采用`TSOA`依赖，开发环境访问 `http://localhost:port（默认3000）/api-docs`。`controller`文件按照`TSOA`规范书写， 可以实现自动扫描生成标准`UI`文档。

#### 配置代码

由于`TSOA`是自动生成，`src/config/swagger.ts`下的内容为展示页面的全局标题展示内容设置文件，在`app.ts`中挂载覆写：

```ts
/**
 * ============================================================
 * Swagger / OpenAPI 文档全局信息（config/swagger.ts）
 * ------------------------------------------------------------
 * 职责：为 TSOA 自动生成的 swagger.json 补充"全局说明"，
 *       由 app.ts 启动时 Object.assign 合并进 spec.info。
 *
 * 内容设计（6 节，每节默认折叠，点击展开）：
 *   1. 响应格式   —— 固定约定，写死
 *   2. 鉴权方式   —— 固定约定，写死
 *   3. 分页参数   —— 固定约定，写死
 *   4. 错误代码   —— 自动生成：code 来自 constants/errorCode.ts，
 *                    中文说明来自同文件 ERROR_DESC
 *   5. 消息代码   —— 自动生成：来自 constants/messageCode.ts + MESSAGE_DESC
 *   6. 状态代码   —— 自动生成：来自 constants/statusCode.ts + STATUS_DESC
 *
 * 说明：中文说明（DESC）与代码定义放在同一 constants 文件里，
 *       新增错误码/消息码/状态码时只需在定义处补一行，
 *       Swagger 文档自动同步，无需改动本文件。
 * ============================================================
 */

import { ERROR_CODE, ERROR_DESC } from "../constants/errorCode";
import { MESSAGE_CODE, MESSAGE_DESC } from "../constants/messageCode";
import { STATUS_CODE, STATUS_DESC } from "../constants/statusCode";
import { ROLE, ROLE_DESC } from "../constants/role";

/** 由常量对象生成 Markdown 表格行（key → code → 说明） */
function buildTableRows(map: Record<string, number>, descMap: Record<string, string>): string {
  return Object.entries(map)
    .map(([key, code]) => `| ${code} | ${key} | ${descMap[key] ?? key} |`)
    .join("\n");
}

/** 消息码表格（标识字符串，无数字码） */
function buildMsgRows(descMap: Record<string, string>): string {
  return Object.keys(MESSAGE_CODE)
    .map((key) => `| ${MESSAGE_CODE[key as keyof typeof MESSAGE_CODE]} | ${descMap[key] ?? key} |`)
    .join("\n");
}

/** 角色表格（角色 code 字符串，无数字码） */
function buildRoleRows(descMap: Record<string, string>): string {
  return Object.keys(ROLE)
    .map((key) => `| ${ROLE[key as keyof typeof ROLE]} | ${descMap[key] ?? key} |`)
    .join("\n");
}

/** 合并进自动生成文档的全局信息（title/version 保留 tsoa 生成值，这里只补 description） */
export const swaggerInfo = {
  description: `
# Express + TypeScript + Prisma + TSOA Template

<details>
<summary>📌 1. 响应格式</summary>

所有接口返回统一结构：
\`\`\`json
{
  "code": 200,          // 业务状态码，200 表示成功（见第 4 节错误代码）
  "msg": "SUCCESS",      // 消息代码，前端按 code/msg 映射多语言（见第 5 节）
  "data": {},            // 返回数据
  "timestamp": 1728624000000  // 服务器时间戳（毫秒）
}
\`\`\`

> 说明：即使业务失败，HTTP 状态码通常仍为 200，业务结果以 body.code 为准。

</details>

<details>
<summary>🔐 2. 鉴权方式</summary>

- 除标注 \`security: []\` 的接口外，所有接口都需要登录
- 请求头携带：\`Authorization: Bearer <accessToken>\`
- token 通过 \`POST /api/v1/auth/login\` 登录获取
- 点右上角 **Authorize** 按钮输入 token，即可调试需要登录的接口

</details>

<details>
<summary>📄 3. 分页参数</summary>

- \`page\`：页码，默认 1
- \`pageSize\`：每页条数，默认 10，最大 100
- 分页接口返回：\`{ list, total, page, pageSize }\`

</details>

<details>
<summary>⚠️ 4. 错误代码</summary>

| Code | 标识 | 说明 |
| ---- | ---- | ---- |
${buildTableRows(ERROR_CODE, ERROR_DESC)}

</details>

<details>
<summary>✅ 5. 消息代码</summary>

| 标识 | 说明 |
| ---- | ---- |
${buildMsgRows(MESSAGE_DESC)}

</details>

<details>
<summary>🔢 6. 状态代码</summary>

| Code | 标识 | 说明 |
| ---- | ---- | ---- |
${buildTableRows(STATUS_CODE, STATUS_DESC)}

</details>

<details>
<summary>👤 7. 角色配置</summary>

| Code | 说明 |
| ---- | ---- |
${buildRoleRows(ROLE_DESC)}

</details>
`,
};

export default swaggerInfo;
```

> 网站头部信息是通过该文件进行设置，里面的常量代码动态获取

### 上传配置

`src/config/upload.config.ts`为文件上传配置：

```ts
/**
 * ============================================================
 * 文件上传配置（config/upload.config.ts）
 * ------------------------------------------------------------
 * 从 env.schema 读取：
 *   - UPLOAD_DIR：上传文件存储目录
 *   - MAX_FILE_SIZE：单文件大小上限（字节）
 *   - allowedTypes：允许的 MIME 类型列表
 * ============================================================
 */

import env from "./env.schema";

export interface UploadConfig {
  dir: string;
  maxSize: number;
  allowedTypes: string[];
}

const uploadConfig: UploadConfig = {
  dir: env.UPLOAD_DIR,
  maxSize: env.MAX_FILE_SIZE,
  allowedTypes: ["image/jpeg", "image/png", "image/gif", "application/pdf"],
};

export default uploadConfig;
```

## 数据配置

### 数据约束

本模板支持2种数据库，分别为`MySQL`，`SQLite`的数据库存储功能，采用`prisma`实现，`src/prisma/schema.prisma`约束了相关数据库字段的类型及样式：

```prisma
// ============================================================
// Express + TypeScript 后端框架模板 —— Prisma Schema
// ------------------------------------------------------------
// 设计约定：
// 1. 字段 camelCase，通过 @map 映射数据库 snake_case 列
// 2. 数据库二态：sqlite（默认，零配置）/ mysql（生产）
//    ★ Prisma 7 新架构（Driver Adapters）：
//      - schema 不再写 url（已弃用），连接串只在 prisma.config.ts
//        和 src/db/prisma.ts（运行时 adapter）两处配置
//      - 切 MySQL 步骤：provider 改 "mysql" + DATABASE_URL 换
//        mysql:// 串 + prisma.config.ts 无需改（读同一 env）→
//        npx prisma generate → npx prisma migrate deploy
// 3. 权限模型：完整 RBAC（用户-角色-菜单/权限点-按钮），
//    通过 user_roles / role_menus 关联，User 无冗余 role 字段
// ============================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
}

// ---------------- 用户表 ----------------
model User {
  id           Int       @id @default(autoincrement())
  username     String    @unique
  passwordHash String    @map("password_hash")      // bcrypt 哈希
  realName     String?   @map("real_name") @default("")
  email        String    @default("")  // 邮箱（注册/创建用户必填；NOT NULL，历史数据兜底空串）
  status       Int       @default(1)                // 1 正常 0 禁用
  lastLoginAt  DateTime? @map("last_login_at")
  isDeleted    Int       @map("is_deleted") @default(0)  // 软删除：0 否 1 是
  deletedAt    DateTime? @map("deleted_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  // 关系
  roles         UserRole[]
  refreshTokens RefreshToken[]
  notifications Notification[]
  operationLogs OperationLog[]

  @@map("users")
}

// ---------------- RBAC：角色表 ----------------
model Role {
  id          Int      @id @default(autoincrement())
  code        String   @unique          // 角色编码，如 admin / operator / viewer
  name        String                     // 角色名称，如 管理员
  description String?  @default("")
  status      Int      @default(1)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  users UserRole[]
  menus RoleMenu[]

  @@map("roles")
}

// ---------------- RBAC：菜单/权限表（目录·菜单·按钮三级） ----------------
model Menu {
  id         Int      @id @default(autoincrement())
  parentId   Int      @map("parent_id") @default(0)   // 0 = 顶级
  name       String                                   // 菜单/权限点名称
  type       String   @default("MENU")                // DIR 目录 / MENU 菜单 / BUTTON 按钮
  path       String?  @default("")                    // 前端路由路径
  component  String?  @default("")                    // 前端组件路径
  icon       String?  @default("")
  group      String?  @default("") @map("menu_group") // 菜单分组标识（DIR/MENU 可选；空=前端不渲染该分组；列名避开 MySQL 保留字 GROUP）
  permission String?  @default("")                    // 权限码，如 adminCenter:user:list
  sort       Int      @default(0)
  status     Int      @default(1)
  visible    Int      @default(1)                     // 是否显示在侧边栏：1 显示 0 隐藏（有权限但不出现在菜单）
  isDeleted  Int      @map("is_deleted") @default(0)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  roles RoleMenu[]

  @@map("menus")
}

// ---------------- RBAC：用户-角色关联表 ----------------
model UserRole {
  userId Int @map("user_id")
  roleId Int @map("role_id")
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role   Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@map("user_roles")
}

// ---------------- RBAC：角色-菜单关联表 ----------------
model RoleMenu {
  roleId Int @map("role_id")
  menuId Int @map("menu_id")
  role   Role @relation(fields: [roleId], references: [id], onDelete: Cascade)
  menu   Menu @relation(fields: [menuId], references: [id], onDelete: Cascade)

  @@id([roleId, menuId])
  @@map("role_menus")
}

// ---------------- 系统参数表 ----------------
model SystemConfig {
  id              Int      @id @default(autoincrement())
  configKey       String   @unique @map("config_key")
  configValue     String?  @map("config_value")
  description     String?  @default("")
  editable        Int      @default(1) // 1=可修改 0=锁定
  configScope     String   @default("system") @map("config_scope") // system / super
  configGroup     String   @default("") @map("config_group")
  readScope       String   @default("all") @map("read_scope")      // all / super
  valueType       String   @default("string") @map("value_type")
  defaultValue    String?  @map("default_value")
  validationJson  String?  @default("") @map("validation_json")
  envKey          String?  @default("") @map("env_key")
  restartRequired Int      @default(0) @map("restart_required")
  sort            Int      @default(0)
  status          Int      @default(1)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("system_configs")
}

// ---------------- 操作日志表（业务审计） ----------------
model OperationLog {
  id          Int      @id @default(autoincrement())
  userId      Int?     @map("user_id")
  username    String?  @default("")
  module      String?  @default("")     // 模块名，如 user
  action      String?  @default("")     // 动作，如 创建/更新/删除
  description String?  @default("")
  ip          String?  @default("")
  createdAt   DateTime @default(now()) @map("created_at")

  user User? @relation(fields: [userId], references: [id])

  @@map("operation_logs")
}

// ---------------- 消息通知表 ----------------
model Notification {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  title     String
  content   String
  type      String   @default("info")   // info / warning / error 等
  data      String   @default("{}")     // 扩展数据 JSON 字符串
  isRead    Int      @map("is_read") @default(0)
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@map("notifications")
}

// ---------------- 安全：刷新令牌表 ----------------
model RefreshToken {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  tokenHash String   @map("token_hash")  // 只存哈希，不存明文
  expiresAt DateTime @map("expires_at")
  revoked   Boolean  @default(false)     // 登出/吊销标记
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}

// ---------------- 安全：登录失败记录表 ----------------
// 按用户名记录（登录时用户可能不存在，故不关联 User 表）
model LoginAttempt {
  id            Int       @id @default(autoincrement())
  username      String
  failedCount   Int       @map("failed_count") @default(0)
  lockedUntil   DateTime? @map("locked_until")   // 锁定截止时间，null 未锁定
  lastAttemptAt DateTime? @map("last_attempt_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  @@index([username])
  @@map("login_attempts")
}

// ---------------- 数据字典：字典类型表 ----------------
model DictType {
  id        Int       @id @default(autoincrement())
  typeCode  String    @unique @map("type_code")   // 如 order_status
  typeName  String    @map("type_name")           // 如 订单状态
  status    Int       @default(1)
  remark    String?   @default("")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  data DictData[]

  @@map("dict_types")
}

// ---------------- 数据字典：字典项表 ----------------
model DictData {
  id         Int      @id @default(autoincrement())
  dictTypeId Int      @map("dict_type_id")
  label      String                            // 显示文案，如 已发货
  value      String                             // 存储值，如 2
  sort       Int      @default(0)
  status     Int      @default(1)
  createdAt  DateTime @default(now()) @map("created_at")

  dictType DictType @relation(fields: [dictTypeId], references: [id], onDelete: Cascade)

  @@index([dictTypeId])
  @@map("dict_data")
}

```

### 数据种子

因模板内置数据库表及相应数据，案例中提供了支撑运行的最小数据量，`src/prisma/seed.ts`为数据种子文件，可以在此对默认数据进行配置生成：

```prisma
/**
 * ============================================================
 * 数据库种子脚本（prisma/seed.ts）
 * ------------------------------------------------------------
 * 职责：初始化 RBAC 基础数据：
 *   1. 四个内置角色：superAdmin（超级管理员）/ admin（管理员）/ operator（操作员）/ viewer（只读）
 *   2. 菜单权限点：Settings 组（systemSettings + adminCenter 用户/日志/通知）+ superAdmin 组「超级面板」（超级设置 + 超级管理 DIR 及其 9 项子菜单）
 *   3. 默认管理员账号（.env 的 ADMIN_USERNAME / ADMIN_PASSWORD）
 *   4. 角色-菜单绑定：superAdmin 全量 56 码（含超级面板 9 项），admin 业务运营 26 码（含角色列表只读）（四中心已收缩），operator 15 / viewer 14
 *   5. 超级管理员账号：固定 superAdmin（种子后不可改，仅设计者维护，对普通角色隐藏）
 *
 * 执行：npm run db:seed
 * 幂等：重复执行不会产生重复数据（按 code / username 判重）
 * ============================================================
 */

import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import path from "path";
// 角色码统一引用 constants/role.ts（唯一权威源，与业务代码共享，避免双源）
import { ROLE } from "../src/constants/role";

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
          connectionLimit: 10,
        });
      })()
    : new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/** RBAC：内置角色定义（code 来自 constants/role.ts 的 ROLE 常量） */
const BUILTIN_ROLES = [
  { code: ROLE.SUPER_ADMIN, name: "超级管理员", description: "仅设计者维护，全部权限（含字典/角色/权限/菜单管理）" },
  { code: ROLE.ADMIN, name: "管理员", description: "系统管理员：全部业务权限（四中心已收缩给 superAdmin）" },
  { code: ROLE.OPERATOR, name: "操作员", description: "可管理业务数据" },
  { code: ROLE.VIEWER, name: "只读用户", description: "仅可查看" },
] as const;

### 内置账号

| 账号 | 密码 | 说明 |
| --- | --- | --- |
| `admin` | `.env` 的 `ADMIN_PASSWORD`（默认 123456） | 系统管理员，业务运营权限（26 码，含角色列表只读） |
| `superAdmin` | `superAdmin123456@`（明文仅备注于种子文件） | 超级管理员，全量 56 码；**种子初始化后永久不可修改**（用户名/密码/realName/邮箱），仅设计者维护 |

/** RBAC：内置菜单权限点（29 条业务菜单 + 27 个隐藏权限点，完整数据见 prisma/seed.ts） */
// mockId：脚本内引用键（parentMockId 指向父项）；落库 id 由数据库自增
// menu_group：菜单分组标识（DIR/MENU 顶层用组名；子级统一 ""）
// 隐藏权限点（type=BUTTON visible=0）：仅提供后端接口权限码，不进前端菜单树
const BUILTIN_MENUS: BuiltinMenu[] = [
  // General 组：dashBoard + dataSearch
  { mockId: 1, parentMockId: 0, name: "menu.menu.dashBoard", type: "MENU", path: "/dashboard", component: "@/pages/dashboard/index.vue", icon: "FullScreen", menu_group: "menu.group.General", permission: "dashBoard:list", sort: 11, visible: 1 },
  { mockId: 2, parentMockId: 0, name: "menu.menu.dataSearch", type: "MENU", path: "/data-search", component: "@/pages/data-search/index.vue", icon: "DataLine", menu_group: "menu.group.General", permission: "dataSearch:list", sort: 12, visible: 1 },
  // Tasks 组：designTasks（cuttingMachine/testMachine）+ projects（tickets/orders）
  // Settings 组：systemSettings / adminCenter（userCenter/logsCenter/noticeCenter）/ about（githubPage/appDown/credits/help）
  // superAdmin 组「超级面板」：superSettings + superAdmin.title(DIR) → healthCheck/sessionCenter/metrics/taskCenter/dictCenter/roleCenter/menuCenter/knowledgeCenter/permissionCenter
  // …… 其余业务菜单 + 27 个隐藏权限点（mockId 2001-2029 剔除 2025/2027，BUTTON visible=0）完整数据见 prisma/seed.ts
] as const;

// 菜单初始化（节选）：按 mockId 建立父子关系；查重键 name+type；落库 id 自增
const menuIdMap = new Map<number, number>();
for (const m of BUILTIN_MENUS) {
  const parentId = m.parentMockId ? (menuIdMap.get(m.parentMockId) ?? 0) : 0;
  const exist = await prisma.menu.findFirst({ where: { name: m.name, type: m.type } });
  const data = { parentId, path: m.path, component: m.component, icon: m.icon, group: m.menu_group, permission: m.permission, sort: m.sort, visible: m.visible };
  const created = exist
    ? await prisma.menu.update({ where: { id: exist.id }, data })
    : await prisma.menu.create({ data: { ...data, name: m.name, type: m.type } });
  menuIdMap.set(m.mockId, created.id);
}

// 角色-菜单绑定（节选）：admin 全量（业务 + 隐藏权限点）；operator/viewer 按角色表格
const bindings: Record<string, number[]> = {
  admin: [...BIZ_MOCK_IDS, ...HIDDEN_MOCK_IDS].map((id) => menuIdMap.get(id)!),
  operator: [1, 2, 3, 31, 32, 4, 41, 42, 6, 9, 10, 101, 102, 103, 104].map((id) => menuIdMap.get(id)!),
  viewer: [1, 2, 3, 31, 32, 4, 41, 42, 9, 10, 101, 102, 103, 104].map((id) => menuIdMap.get(id)!),
};
for (const [roleCode, menuIds] of Object.entries(bindings)) {
  await prisma.roleMenu.deleteMany({ where: { roleId: roleMap.get(roleCode)! } });
  await prisma.roleMenu.createMany({ data: menuIds.map((menuId) => ({ roleId: roleMap.get(roleCode)!, menuId })) });
}
  console.log("✅ 角色-菜单绑定完成");

  // ---------- 4. 默认管理员账号 ----------
  const username = process.env.ADMIN_USERNAME || "administrator";
  const password = process.env.ADMIN_PASSWORD || "123456";

  const hashedPassword = await bcrypt.hash(password, 10);
  const adminRoleId = roleMap.get("admin");

  // 用户不存在则创建，并绑定 admin 角色
  const adminUser = await prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      passwordHash: hashedPassword,
      realName: "管理员",
      status: 1,
    },
  });

  // 绑定 admin 角色（幂等：先删后建）
  if (adminRoleId) {
    await prisma.userRole.deleteMany({ where: { userId: adminUser.id } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRoleId } });
  }

  console.log(`✅ 默认管理员初始化完成: ${username}`);
}

main()
  .catch((e) => {
    console.error("❌ 种子脚本执行失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

```

### 数据备份

在`MySQL`场景下，可通过如下方式实现数据库备份：

```bash
npm run db:seed   # 备份命令已随精简移除，需备份时直接：
npx tsx scripts/backup.ts
```

- `mysql:` `mysqldump` 导出 `SQL`
- `sqlite:` `WAL checkpoint `后复制 `db` 文件
- 默认保留最近 7 份（`BACKUP_KEEP` 可配）

### 单例对象

`src/db/prisma.ts`为客户端单例，为不同的数据库配置专用适配器：

```ts
/**
 * ============================================================
 * Prisma 客户端单例（db/prisma.ts）
 * ------------------------------------------------------------
 * Prisma 7 新架构（Driver Adapters）：
 *   1. 根据 .env 的 DB_TYPE 选择数据库适配器：
 *      - mysql  → PrismaMysql（@prisma/adapter-mysql）
 *      - sqlite → PrismaBetterSQLite3（@prisma/adapter-better-sqlite3）
 *   2. 连接串来自 .env 的 DATABASE_URL（与 prisma.config.ts 同一来源）
 *   3. 导出统一 prisma 实例，业务代码只 import { prisma }
 *
 * 用法：import { prisma } from "@src/db/prisma";
 *       await prisma.user.findFirst();
 *
 * 注意：切换数据库需同步：schema.prisma provider + .env DATABASE_URL
 *       → npx prisma generate → 重启服务
 * ============================================================
 */

import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import dbConfig from "../config/db.config";

/** 根据 DB_TYPE 创建带对应 Driver Adapter 的 PrismaClient */
function createPrismaClient(): PrismaClient {
  if (dbConfig.type === "mysql") {
    // MySQL/MariaDB 专用适配器（参数取自 db.config 解析后的连接串）
    const adapter = new PrismaMariaDb({
      host: dbConfig.mysql.host,
      port: dbConfig.mysql.port,
      user: dbConfig.mysql.user,
      password: dbConfig.mysql.password,
      database: dbConfig.mysql.database,
      connectionLimit: 10,
    });
    return new PrismaClient({ adapter });
  }

  // SQLite 专用适配器（连接串 file:./data/app.db）
  const adapter = new PrismaBetterSqlite3({ url: dbConfig.url });
  return new PrismaClient({ adapter });
}

/** Prisma 客户端单例 */
export const prisma = createPrismaClient();

export default prisma;
```

## 核心功能

### 响应格式

`src/middleware/response.middleware.ts`为统一响应格式中间件文件：

```ts
/**
 * ============================================================
 * 统一响应格式中间件（middleware/response.middleware.ts）
 * ------------------------------------------------------------
 * 给 res 对象挂载 success / error 方法
 * 所有接口统一返回结构：{ code, msg, data, timestamp }
 * msg 返回英文标识，前端按 code 映射多语言
 * ============================================================
 */

import { Request, Response, NextFunction } from "express";
import { ERROR_CODE, CODE_TO_MSG } from "../constants/errorCode";
import { MESSAGE_CODE } from "../constants/messageCode";

/** 扩展 Express Response 类型，挂载自定义方法 */
declare global {
  namespace Express {
    interface Response {
      /** 成功响应 */
      success: (data?: any, msg?: string, code?: number) => void;
      /** 失败响应 */
      error: (error: string | number, code?: number) => void;
    }
  }
}

/** 统一响应中间件 */
export default function responseMiddleware(req: Request, res: Response, next: NextFunction): void {
  /** 成功响应 */
  res.success = (data: any = null, msg: string = MESSAGE_CODE.SUCCESS, code: number = ERROR_CODE.SUCCESS): void => {
    res.json({
      code,
      msg,
      data,
      timestamp: Date.now(),
    });
  };

  /** 失败响应：支持 res.error("USER_NOT_EXIST") 或 res.error(ERROR_CODE.UNAUTHORIZED) */
  res.error = (error: string | number, code: number = ERROR_CODE.PARAM_ERROR): void => {
    let msg: string;
    let errorCode: number = code;

    if (typeof error === "number") {
      errorCode = error;
      // 数字码 → 自动反查字符串标识，与 TSOA 路由的响应约定一致
      msg = CODE_TO_MSG[error] ?? "UNKNOWN_ERROR";
    } else {
      msg = error;
    }

    res.json({
      code: errorCode,
      msg,
      data: null,
      timestamp: Date.now(),
    });
  };

  next();
}
```

### 错误处理

`src/middleware/error.middleware.ts`为统一处理错误中间件文件：

```ts
/**
 * ============================================================
 * 全局错误处理中间件（middleware/error.middleware.ts）
 * ------------------------------------------------------------
 * 捕获所有路由抛出的异常，统一返回标准格式
 * 必须放在所有路由之后注册
 * 识别错误类型：
 *   - BusinessError（业务错误）
 *   - JWT 错误（JsonWebTokenError / TokenExpiredError）
 *   - Multer 上传错误
 *   - 数据库错误（Prisma 错误）
 *   - 未知错误
 * 使用 Pino 结构化日志记录错误详情
 * ============================================================
 */

import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import logger from "../utils/logger";
import { ERROR_CODE, CODE_TO_MSG } from "../constants/errorCode";
import { ERROR_MAP } from "../constants/errorMap";

/**
 * 业务错误类
 * controller / service 里主动 throw new BusinessError(20001, 'USER_NOT_FOUND')
 */
export class BusinessError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = "BusinessError";
    this.code = code;
  }
}

/** 组装统一错误响应（msg 不传时自动从 CODE_TO_MSG 反查标识，杜绝手写字符串散落） */
function buildErrorRes(code: number, msg?: string) {
  return {
    code,
    msg: msg ?? CODE_TO_MSG[code] ?? "UNKNOWN_ERROR",
    data: null,
    timestamp: Date.now(),
  };
}

/**
 * 全局错误处理中间件
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  // 结构化日志记录错误（含请求信息）
  logger.error(
    {
      method: req.method,
      url: req.url,
      errName: err?.name,
      errCode: err?.code,
      stack: process.env.NODE_ENV !== "production" ? err?.stack : undefined,
    },
    `[ERROR] ${req.method} ${req.url} - ${err?.message}`
  );

  // 1. 业务错误（直接 throw new Error("XXX") 的）
  if (ERROR_MAP[err.message]) {
    const code = ERROR_MAP[err.message];
    res.json(buildErrorRes(code));
    return;
  }

  // 2. 业务错误类（主动 throw new BusinessError 的）
  if (err instanceof BusinessError) {
    res.json(buildErrorRes(err.code, err.message));
    return;
  }

  // 3. TSOA 鉴权错误（expressAuthentication reject 的对象，由 routes.ts 的
  //    authenticateMiddleware 通过 next(error) 抛出）
  //    注意：routes.ts 会给所有鉴权失败错误强加 status=401
  //    （error.status = error.status || 401），所以必须先按 err.name 区分
  //    具体类型（Forbidden → 10104 / TokenExpired → 10102 / JsonWebToken → 10103），
  //    再把 status===401 作为 UNAUTHORIZED 的兜底放在最后，否则会被 401 分支抢先
  if (err?.name === "Forbidden" || err?.status === 403) {
    res.json(buildErrorRes(ERROR_CODE.PERMISSION_DENIED));
    return;
  }

  // 4. JWT 错误
  if (err?.name === "TokenExpiredError") {
    res.json(buildErrorRes(ERROR_CODE.TOKEN_EXPIRED));
    return;
  }
  if (err?.name === "JsonWebTokenError" || err?.name === "NotBeforeError") {
    res.json(buildErrorRes(ERROR_CODE.TOKEN_INVALID));
    return;
  }
  // Unauthorized（无 token / 兜底）：name 命中，或仅带 401 状态码（如 TSOA 强加）
  if (err?.name === "Unauthorized" || err?.status === 401) {
    res.json(buildErrorRes(ERROR_CODE.UNAUTHORIZED));
    return;
  }

  // 4. TSOA 参数校验错误（@Body/@Query 等必需参数缺失时由框架抛出，
  //    先于 controller 执行，如空 body 的 POST；结构与 Joi 的 ValidationError 不同）
  if (err.name === "ValidateError" && err.fields) {
    // fields 形如 { "body": {...} } 或 { "body.username": {...} }（点路径）
    const firstKey = Object.keys(err.fields)[0] ?? "param";
    res.json(buildErrorRes(ERROR_CODE.PARAM_INVALID, `PARAM_INVALID:${firstKey}`));
    return;
  }

  // 4. Joi 校验错误（带字段名，与 BaseController.failJoi 格式一致）
  if (err.name === "ValidationError" && err.details) {
    const field = err.details[0]?.path?.join(".") ?? "param";
    res.json(buildErrorRes(ERROR_CODE.PARAM_INVALID, `PARAM_INVALID:${field}`));
    return;
  }

  // 5. Multer 上传错误
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.json(buildErrorRes(ERROR_CODE.FILE_TOO_LARGE));
      return;
    }
    res.json(buildErrorRes(ERROR_CODE.FILE_UPLOAD_FAIL));
    return;
  }

  // 6. Prisma 数据库错误
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 = unique constraint（如用户名重复）
    if (err.code === "P2002") {
      res.json(buildErrorRes(ERROR_CODE.USER_ALREADY_EXIST));
      return;
    }
    res.json(buildErrorRes(ERROR_CODE.DATABASE_ERROR));
    return;
  }

  // 7. 语法错误 / 类型错误（代码 bug）
  if (err instanceof SyntaxError || err instanceof TypeError) {
    res.json(buildErrorRes(ERROR_CODE.SYSTEM_ERROR));
    return;
  }

  // 8. 未知错误（兜底）
  res.json(buildErrorRes(ERROR_CODE.UNKNOWN_ERROR));
}

/**
 * 404 处理中间件
 * 所有路由都没匹配到时走这里
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(buildErrorRes(ERROR_CODE.NOT_FOUND));
}
```

### 权限鉴权

`src/middleware/auth.middleware.ts`为统一处理 鉴权中间件文件：

```ts
/**
 * ============================================================
 * 鉴权中间件（middleware/auth.middleware.ts）
 * ------------------------------------------------------------
 * 提供：
 *   - requireAuth：通用登录校验中间件（手写路由用）
 *     校验 Access Token（type=access），解析通过后挂载 req.user
 *   - requirePermission：通用权限校验中间件（手写路由用）
 *     requireAuth 之后使用，按权限码校验 RBAC
 *   - expressAuthentication：TSOA 自动生成的 routes 调用的鉴权入口
 *     （@Security("bearerAuth") 会走这里，scopes 传权限码）
 *
 * 权限校验逻辑（RBAC）：
 *   1. 校验 Access Token（type=access）
 *   2. 查询用户当前角色绑定的菜单权限码集合
 *   3. 校验请求所需的权限码是否在集合内
 * ============================================================
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import jwtConfig from "../config/jwt.config";
import { prisma } from "../db/prisma";
import { ERROR_CODE, CODE_TO_MSG } from "../constants/errorCode";
import { STATUS_CODE } from "../constants/statusCode";

/**
 * 查询用户拥有的全部权限码（RBAC 核心查询）
 * users -> user_roles -> roles -> role_menus -> menus
 * 只取 type=BUTTON/MENU 且 permission 非空的权限码
 */
async function getUserPermissions(userId: number): Promise<string[]> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          menus: {
            include: {
              menu: true,
            },
          },
        },
      },
    },
  });

  const perms = new Set<string>();
  for (const ur of userRoles) {
    for (const rm of ur.role.menus) {
      if (rm.menu.permission) perms.add(rm.menu.permission);
    }
  }
  return Array.from(perms);
}

/** 从 Authorization 头解析并校验 Access Token，返回 decoded 或错误对象 */
function verifyAccessToken(
  req: Request
): { ok: true; decoded: any } | { ok: false; error: { name: string; message: string; status: number } } {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, error: { name: "Unauthorized", message: "No token provided", status: 401 } };
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded: any = jwt.verify(token, jwtConfig.secret);
    // 只用 Access Token 做鉴权（type=access），防止 refresh 冒充
    if (decoded.type !== "access") {
      return { ok: false, error: { name: "JsonWebTokenError", message: "Invalid token type", status: 401 } };
    }
    return { ok: true, decoded };
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") {
      return { ok: false, error: { name: "TokenExpiredError", message: "Token expired", status: 401 } };
    }
    return { ok: false, error: { name: "JsonWebTokenError", message: "Invalid token", status: 401 } };
  }
}

/**
 * 通用登录校验中间件（手写路由用）
 * 用法：router.get("/list", requireAuth, handler)
 * 校验通过后 req.user = { userId, username, ... }；失败交给 errorHandler（10101/10102/10103）
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const result = verifyAccessToken(req);
  if (!result.ok) {
    next(result.error);
    return;
  }
  (req as any).user = result.decoded;
  next();
}

/**
 * 通用权限校验中间件（手写路由用）
 * 用法：router.get("/list", requireAuth, requirePermission("adminCenter:user:list"), handler)
 * 注意：权限校验依赖 req.user（必须先经过 requireAuth 或手动挂载）
 */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user as { userId: number } | undefined;
    if (!user) {
      res
        .status(STATUS_CODE.UNAUTHORIZED)
        .json({ code: ERROR_CODE.UNAUTHORIZED, msg: CODE_TO_MSG[ERROR_CODE.UNAUTHORIZED], data: null, timestamp: Date.now() });
      return;
    }

    const perms = await getUserPermissions(user.userId);
    if (!perms.includes(permission)) {
      res
        .status(STATUS_CODE.FORBIDDEN)
        .json({ code: ERROR_CODE.PERMISSION_DENIED, msg: CODE_TO_MSG[ERROR_CODE.PERMISSION_DENIED], data: null, timestamp: Date.now() });
      return;
    }
    next();
  };
}

/**
 * TSOA 认证中间件入口（兼容保留，供 @tsoa 自动生成的路由使用）
 * TSOA 自动生成的 routes.ts 会调用这个函数
 * 用法（controller 内）：
 *   @Security("bearerAuth")               // 只要登录
 *   @Security("bearerAuth", ["adminCenter:user:list"])  // 需要指定权限码
 */
export function expressAuthentication(request: Request, securityName: string, scopes?: string[]): Promise<any> {
  return new Promise(async (resolve, reject) => {
    if (securityName === "bearerAuth") {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reject({ name: "Unauthorized", message: "No token provided" });
      }

      const token = authHeader.split(" ")[1];

      // 解析并校验 token（区分过期/无效/类型错误，error.middleware 按 name 映射 10102/10103）
      let decoded: any;
      try {
        decoded = jwt.verify(token, jwtConfig.secret);
      } catch (err: any) {
        // TokenExpiredError → 10102；JsonWebTokenError → 10103
        if (err?.name === "TokenExpiredError") {
          return reject({ name: "TokenExpiredError", message: "Token expired" });
        }
        return reject({ name: "JsonWebTokenError", message: "Invalid token" });
      }

      // 只用 Access Token 做鉴权（type=access），防止 refresh 冒充
      if (decoded.type !== "access") {
        return reject({ name: "JsonWebTokenError", message: "Invalid token type" });
      }

      // 需要权限码时，查 RBAC 权限集合并校验
      if (scopes && scopes.length > 0) {
        try {
          const perms = await getUserPermissions(decoded.userId);
          const hasAll = scopes.every((s) => perms.includes(s));
          if (!hasAll) {
            return reject({ name: "Forbidden", message: "Permission denied" });
          }
        } catch (err) {
          return reject({ name: "Unauthorized", message: "Permission check failed" });
        }
      }

      // 把用户信息挂到 request 上
      (request as any).user = decoded;
      return resolve(decoded);
    }

    // 其它 security 类型（如 @Security("")）直接放行
    resolve({});
  });
}
```

### 前端跨域

`src/middleware/cors.middleware.ts`为统一处理前端跨域文件，无需前端挂代理：

```ts
/**
 * ============================================================
 * 跨域中间件（middleware/cors.middleware.ts）
 * ------------------------------------------------------------
 * 统一配置 CORS：
 *   - 开发环境：允许所有来源
 *   - 生产环境：从 CORS_ORIGINS 环境变量读取白名单域名（逗号分隔）
 * ============================================================
 */

import cors from "cors";
import env from "../config/env.schema";

/** 生产环境白名单来源（逗号分隔，如 https://admin.example.com） */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "").split(",").filter(Boolean);

const corsOptions: cors.CorsOptions = {
  // 开发环境放开；生产环境仅允许白名单
  origin:
    env.NODE_ENV === "production"
      ? ALLOWED_ORIGINS.length > 0
        ? ALLOWED_ORIGINS
        : false // 白名单为空则全部拒绝（安全）
      : true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Disposition"],
  credentials: true,
};

export default cors(corsOptions);
```

### 启动初始

`src/middleware/dotenvInit.middleware.ts`为环境变量初始化中间件，自动检测`IP`并自动写入`.env`内：

```ts
/**
 * ============================================================
 * 环境变量初始化中间件（middleware/dotenvInit.middleware.ts）
 * ------------------------------------------------------------
 * npm run init 时执行（dev 启动前自动运行）：
 *   1. 自动检测本机局域网 IP（IPv4，跳过回环）
 *   2. 写入 .env 文件的 LOCAL_IP 字段
 *   3. 确保 uploads / data 目录存在
 *
 * 用途：启动时把真实局域网 IP 写进 env，
 *       bootstrap 展示访问地址时直接读 LOCAL_IP，
 *       方便手机 / 局域网内其他设备联调（无需手改配置）。
 * ============================================================
 */

import fs from "fs";
import path from "path";
import os from "os";
import dotenv from "dotenv";

/** 自动检测本机局域网 IP（跳过 IPv6 和回环，取第一个内网 IPv4） */
function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // 跳过 IPv6 和回环地址，取内网 IPv4
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

/** 确保必要目录存在（与 .env 的 UPLOAD_DIR / DATABASE_URL 对应） */
function ensureDirs(): void {
  const dirs = ["./uploads", "./data"];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Create Directory: ${dir}`);
    }
  }
}

/** 把检测到的 IP 写入 .env */
function updateLocalIP(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  const localIP = getLocalIP();

  // 读现有 .env
  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf8");
  }

  // 更新或追加 LOCAL_IP
  if (content.includes("LOCAL_IP=")) {
    content = content.replace(/LOCAL_IP=.*/g, `LOCAL_IP=${localIP}`);
  } else {
    content += `\nLOCAL_IP=${localIP}\n`;
  }

  fs.writeFileSync(envPath, content, "utf8");
  // 🌐 本机局域网 IP: ${localIP}（已写入 .env 的 LOCAL_IP）
  console.log(`🌐 Local IP: ${localIP}(Localized IP Written to. env)`);
}

// 执行初始化
ensureDirs();
updateLocalIP();
console.log("✅ Environment Variable Initialization Completed.");
```

### 请求日志

`src/middleware/logger.middleware.ts`为请求日志中间件，记录每个请求的：方法、路径、状态码、耗时、IP， 控制台按状态码着色，绿色 2xx、黄色 4xx、红色 5xx：

```ts
/**
 * ============================================================
 * Pino 请求日志中间件（middleware/logger.middleware.ts）
 * ------------------------------------------------------------
 * 基于 pino-http，自动为每个请求生成结构化 JSON 日志：
 *   - method / url / statusCode / responseTime / ip
 *   - reqId：每个请求的唯一 ID（贯穿日志，便于排查链路）
 * 替代原 console.log 文本日志
 * ============================================================
 */

import { pinoHttp } from "pino-http";
import crypto from "crypto";
import logger from "../utils/logger";

/** pino-http 实例（自动挂 req.log / res.log） */
const httpLogger = pinoHttp({
  logger,

  // 自定义请求 ID 生成：优先沿用外部链路 ID（x-request-id），否则生成新 ID
  // 注意：返回值类型必须是 string | number（ReqId），不能返回 undefined
  genReqId: (req) => {
    const id = req.headers["x-request-id"];
    if (typeof id === "string" && id.length > 0) {
      return id;
    }
    return crypto.randomUUID();
  },

  // 统一日志级别：5xx/异常 error，4xx warn，其余 info
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});

export default httpLogger;
```

### 前端验证

`Captcha`为前端提供验证码验证图片提供依赖，可通过前端的调用实现：

#### 调用流程

1. 前端打开登录页时调用 `GET /api/captcha` 获取验证码
2. 返回 `captchaId` + `img`（SVG 字符串），前端渲染为图片
3. 用户输入后，登录时带上 `captchaId` + `captchaCode`
4. 验证码有效期 120 秒，一次性有效

#### 示例接口

```
GET /api/captcha
Response: { code: 200, data: { captchaId: "xxx", img: "<svg>...</svg>", expiresIn: 120 } }
```

### 操作日志

`src/middleware/operateLog.middleware.ts`自动记录写操作日志，业务审计日志，与运行日志（Pino）职责分离：

```ts
/**
 * ============================================================
 * 操作日志中间件（middleware/operateLog.middleware.ts）
 * ------------------------------------------------------------
 * 自动记录写操作日志（POST / PUT / DELETE）到 operation_logs 表
 * 业务审计日志，与运行日志（Pino）职责分离：
 *   - 运行日志：系统运行状态，走 Pino / logs/app.log
 *   - 操作日志：谁在什么时间做了什么操作，入库可查询
 * ============================================================
 */

import { Request, Response, NextFunction } from "express";
import operateLogService from "../modules/operateLog/operateLog.service";

/**
 * 操作日志中间件
 * 只记录写操作（POST / PUT / DELETE），不记录 GET 查询
 */
export function operateLogMiddleware(req: Request, res: Response, next: NextFunction) {
  const method = req.method;
  if (!["POST", "PUT", "DELETE"].includes(method)) {
    return next();
  }

  // 等响应完成之后再写日志
  res.on("finish", async () => {
    try {
      // 只记录成功（2xx）的操作
      if (res.statusCode < 200 || res.statusCode >= 300) return;

      // 获取当前登录用户信息（从 req.user 里取）
      const user = (req as any).user;
      if (!user) return; // 未登录的不记（如登录接口本身）

      // 从路径里提取模块名，如 /api/v1/license/generate → license
      const path = req.path;
      const segments = path.split("/").filter(Boolean); // 去掉空段
      // /api/v1/{module}/... → module 是第 3 段（index: api=0, v1=1, module=2）
      const module = segments[2] || "unknown";

      // 操作类型用英文标识入库（前端按 i18n 映射展示，避免中文入库）
      const actionMap: Record<string, string> = {
        POST: "CREATE",
        PUT: "UPDATE",
        DELETE: "DELETE",
      };
      const action = actionMap[method] || method;

      await operateLogService.createLog({
        userId: user.userId,
        username: user.username,
        module,
        action,
        description: `${method} ${path}`,
        ip: req.ip || "",
      });
    } catch (e) {
      // 操作日志记录失败：
      console.error("Operation Log Recording Failed:", e);
    }
  });

  next();
}
```

### 访问限流

`src/middleware/rateLimit.middleware.ts`全局基础限流，登录等敏感接口严格限流：

```ts
/**
 * ============================================================
 * 限流中间件（middleware/rateLimit.middleware.ts）
 * ------------------------------------------------------------
 * 分级限流：
 *   - rateLimitMiddleware：全局基础限流（默认 300 req / 15 min / IP）
 *   - loginRateLimitMiddleware：登录等敏感接口严格限流（默认 10 req / 1 min / IP）
 * 配合错误码 TOO_MANY_REQUESTS 返回统一格式
 * ============================================================
 */

import rateLimit from "express-rate-limit";
import env from "../config/env.schema";
import { ERROR_CODE, CODE_TO_MSG } from "../constants/errorCode";
import { STATUS_CODE } from "../constants/statusCode";

/** 限流触发时的统一响应体（msg 从 CODE_TO_MSG 反查，保证与 errorCode 唯一一致） */
const limitReached = {
  statusCode: STATUS_CODE.TOO_MANY_REQUESTS,
  message: CODE_TO_MSG[ERROR_CODE.TOO_MANY_REQUESTS],
  code: ERROR_CODE.TOO_MANY_REQUESTS,
};

/** 全局基础限流（所有 /api 请求） */
export const rateLimitMiddleware = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MIN * 60 * 1000,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(limitReached.statusCode).json({
      code: limitReached.code,
      msg: limitReached.message,
      data: null,
      timestamp: Date.now(),
    });
  },
});

/** 登录/验证码等敏感接口严格限流 */
export const loginRateLimitMiddleware = rateLimit({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MIN * 60 * 1000,
  max: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(limitReached.statusCode).json({
      code: limitReached.code,
      msg: limitReached.message,
      data: null,
      timestamp: Date.now(),
    });
  },
});
```

### 文件上传

#### 核心代码

`src/middleware/upload.middleware.ts`为文件上传中间件,基于 Multer 封装，统一配置：上传目录、文件大小、文件类型：

```ts
/**
 * ============================================================
 * 文件上传中间件（upload.middleware.ts）
 * ------------------------------------------------------------
 * 基于 Multer 封装，统一配置：上传目录、文件大小、文件类型
 * 用法：router.post('/upload', upload.single('file'), controller.upload)
 * ============================================================
 */

import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import uploadConfig from "../config/upload.config";

// 确保上传目录存在
if (!fs.existsSync(uploadConfig.dir)) {
  fs.mkdirSync(uploadConfig.dir, { recursive: true });
}

/** 存储配置：磁盘存储，文件名用 uuid 重命名避免冲突 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadConfig.dir);
  },
  filename: (req, file, cb) => {
    // 保留原文件扩展名，文件名用 uuid
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

/** 文件过滤器：只允许配置里声明的类型 */
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (uploadConfig.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("FILE_TYPE_NOT_ALLOWED"));
  }
};

/** Multer 实例 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: uploadConfig.maxSize,
  },
});
```

#### 基本概念

上传配置统一在 `src/config/upload.config.ts` 中修改（目录、大小、允许类型）。

#### 路由应用

```typescript
// tsoa 版本：在 controller 类方法上加装饰器
import { Route, Tags, Post, Security } from "tsoa";
import { upload } from "@src/middleware/upload.middleware";

@Route("api/upload")
@Tags("Upload")
export class UploadController extends BaseController {
  @Post("file")
  @Security("bearerAuth")
  public async uploadFile(): Promise<void> {
    // 注意：upload.single("file") 中间件需要在 app.ts 全局挂载，
    // 或者在 tsoa 的 @Middlewares 装饰器里声明
    if (!this.req.file) {
      this.res.error("FILE_NOT_EXIST", 70001);
      return;
    }
    this.res.success({ url: `/uploads/${this.req.file.filename}` }, "UPLOAD_SUCCESS");
  }
}
```

> tsoa 上传中间件需要在 app.ts 里全局挂载 `upload.single("file")`，或者用 `@Middlewares()` 装饰器声明。

## 核心工具

### 菜单构建

`src/utils/menuTree.ts`为菜单树构建工具，主要用于把平铺的菜单列表构建为树形结构：

```ts
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
```

### 文件工具

`src/utils/file.ts`为文件操作辅助函数：

```ts
/**
 * ============================================================
 * 文件工具（utils/file.ts）
 * ------------------------------------------------------------
 * 常用文件操作封装：确保目录存在、安全删除文件等
 * ============================================================
 */

import fs from "fs";
import path from "path";

/** 确保目录存在（不存在则递归创建） */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** 安全删除文件（不存在不报错） */
export function safeUnlink(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/** 拼接并规范化路径 */
export function resolvePath(...segments: string[]): string {
  return path.resolve(...segments);
}
```

### JWT工具

`src/utils/jwt.ts`为 `JWT`工具，封装 `token` 签发和校验：

```ts
/**
 * ============================================================
 * JWT 工具（utils/jwt.ts）
 * ------------------------------------------------------------
 * 双令牌机制封装：
 *   - signAccessToken：签发短期 Access Token（请求鉴权）
 *   - signRefreshToken：签发长期 Refresh Token（用于刷新、存库）
 *   - verifyToken：校验并解析 token
 * 安全设计：
 *   - Refresh Token 只存哈希入库（见 auth.service），泄露不可复用
 *   - Access Token 携带会话号（sid）指向 refresh_tokens 记录，
 *     鉴权时校验该会话未吊销/未过期，使「踢下线」立即生效
 * ============================================================
 */

import jwt, { SignOptions } from "jsonwebtoken";
import jwtConfig from "../config/jwt.config";

/** JWT 载荷类型 */
export interface JwtPayload {
  userId: number;
  username: string;
  /** 令牌类型：access 访问令牌 / refresh 刷新令牌 */
  type?: "access" | "refresh";
  [key: string]: any;
}

/**
 * 签发 Access Token（短期，默认 15m）
 * @param payload 用户信息
 */
export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, type: "access" }, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn } as SignOptions);
}

/**
 * 签发 Refresh Token（长期，默认 7d）
 * @param payload 用户信息
 */
export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, type: "refresh" }, jwtConfig.secret, { expiresIn: jwtConfig.refreshExpiresIn } as SignOptions);
}

/**
 * 校验 token，返回解析后的 payload，失败返回 null
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, jwtConfig.secret) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * 校验 Refresh Token（必须 type=refresh，防止拿 access 当 refresh 用）
 */
export function verifyRefreshToken(token: string): JwtPayload | null {
  const payload = verifyToken(token);
  if (!payload || payload.type !== "refresh") return null;
  return payload;
}
```

### 日志工具

`src/utils/logger.ts` 为结构化 `JSON` 日志：控制台输出由 `.env` 的 `LOG_CONSOLE` 决定，文件输出始终写入 `logs/app.log`，并按大小自动轮转。

```ts
/**
 * ============================================================
 * Pino 日志实例（utils/logger.ts）
 * ------------------------------------------------------------
 * 结构化 JSON 日志：
 *   - 控制台输出由 .env 的 LOG_CONSOLE 控制（true/false）
 *   - 文件输出：logs/app.log（JSON 行格式，对接 Loki / ELK）
 *   - 轮转：超过 LOG_MAX_SIZE_MB 自动切分为 app-时间戳.log，
 *     历史文件按 LOG_MAX_FILES 保留
 *
 * 用法：import logger from "@src/utils/logger";
 *       logger.info({ userId: 1 }, "用户创建成功");
 *       logger.error(err, "数据库连接失败");
 * ============================================================
 */

import pino from "pino";
import path from "path";
import env from "../config/env.schema";
import { createRotatingStream } from "./logRotate";

/** 日志目录 */
export const LOG_DIR = path.resolve(process.cwd(), "logs");
/** 单个日志文件大小上限（字节） */
export const LOG_MAX_SIZE_BYTES = env.LOG_MAX_SIZE_MB * 1024 * 1024;

/**
 * 组装输出目标：
 *   - 控制台（LOG_CONSOLE=true）：开发环境 pino-pretty 美化，生产环境原生 JSON
 *   - 文件（始终开启）：按大小轮转写入 logs/app.log
 */
type StreamList = Parameters<typeof pino.multistream>[0];

const streams: StreamList = [];

if (env.LOG_CONSOLE) {
  if (env.NODE_ENV !== "production") {
    streams.push({
      level: "debug",
      stream: pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname",
        },
      }),
    });
  } else {
    streams.push({ level: "info", stream: pino.destination(1) });
  }
}

streams.push({
  level: "info",
  stream: createRotatingStream({
    dir: LOG_DIR,
    baseName: "app.log",
    maxSizeBytes: LOG_MAX_SIZE_BYTES,
    maxFiles: env.LOG_MAX_FILES,
  }),
});

const logger = pino({ level: env.NODE_ENV === "production" ? "info" : "debug" }, pino.multistream(streams));

export default logger;
```

### 日志轮转

`src/utils/logRotate.ts` 负责按大小切分日志：当前文件写入超过 `LOG_MAX_SIZE_MB` 后重命名为 `app-YYYYMMDD-HHMMSSmmm.log`，随后重开同名空文件继续写；历史文件按 `LOG_MAX_FILES` 只保留最新若干份。采用同步 fd 写入，轮转时先 close 再 rename，Windows 下不会出现文件占用冲突；`getLogRotateState()` 供健康检查读取当前大小、上限与历史份数。

```ts
/**
 * ============================================================
 * 日志文件轮转（utils/logRotate.ts）
 * ------------------------------------------------------------
 * 按大小轮转：当前 app.log 写入超过阈值后，重命名为
 * app-YYYYMMDD-HHMMSSmmm.log，随后新开同名空文件继续写。
 *   - 使用同步 fd 写入，轮转时先 close 再 rename，Windows 下不会锁文件
 *   - 历史文件只保留最近 N 份，超出部分按文件名（即时间戳）倒序清理
 *   - getLogRotateState 供健康检查读取当前大小与历史份数
 * ============================================================
 */

import fs from "fs";
import path from "path";
import { Writable } from "stream";

/** 轮转配置 */
export interface RotateOptions {
  /** 日志目录（绝对路径） */
  dir: string;
  /** 当前文件名，如 app.log */
  baseName: string;
  /** 单文件大小上限（字节） */
  maxSizeBytes: number;
  /** 历史文件保留份数（不含当前文件） */
  maxFiles: number;
}

/** 轮转现状（健康检查用） */
export interface RotateState {
  file: string;
  size: number;
  maxSizeBytes: number;
  maxFiles: number;
  history: number;
}

/** 左侧补零 */
function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

/** 轮转文件时间戳：YYYYMMDD-HHMMSSmmm */
function stamp(date: Date): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}${pad(date.getMilliseconds(), 3)}`;
  return `${day}-${time}`;
}

/** 历史文件命名规则：app-*.log */
function historyPattern(opts: RotateOptions): { prefix: string; suffix: string } {
  const suffix = path.extname(opts.baseName);
  const stem = path.basename(opts.baseName, suffix);
  return { prefix: `${stem}-`, suffix };
}

/** 按大小自动轮转的写入流 */
class RotatingFileStream extends Writable {
  private fd: number;
  private size: number;

  constructor(private readonly opts: RotateOptions) {
    super();
    fs.mkdirSync(opts.dir, { recursive: true });
    const file = path.join(opts.dir, opts.baseName);
    this.fd = fs.openSync(file, "a");
    this.size = fs.fstatSync(this.fd).size;
  }

  /** 容量不足时先轮转再写，避免单行把文件撑过上限后才切 */
  private rotateIfNeeded(nextBytes: number): void {
    if (this.size + nextBytes <= this.opts.maxSizeBytes) return;
    const file = path.join(this.opts.dir, this.opts.baseName);
    fs.closeSync(this.fd);
    const { prefix, suffix } = historyPattern(this.opts);
    fs.renameSync(file, path.join(this.opts.dir, `${prefix}${stamp(new Date())}${suffix}`));
    this.fd = fs.openSync(file, "a");
    this.size = 0;
    this.prune();
  }

  /** 清理超出保留份数的历史文件 */
  private prune(): void {
    const { prefix, suffix } = historyPattern(this.opts);
    const history = fs
      .readdirSync(this.opts.dir)
      .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
      .sort()
      .reverse();
    for (const name of history.slice(this.opts.maxFiles)) {
      try {
        fs.unlinkSync(path.join(this.opts.dir, name));
      } catch {
        // 清理失败不阻断写入，下一轮再试
      }
    }
  }

  _write(chunk: Buffer | string, encoding: BufferEncoding, callback: (err?: Error | null) => void): void {
    try {
      const bytes = typeof chunk === "string" ? Buffer.byteLength(chunk, encoding) : chunk.length;
      this.rotateIfNeeded(bytes);
      if (typeof chunk === "string") {
        fs.writeSync(this.fd, chunk, undefined, encoding);
      } else {
        fs.writeSync(this.fd, chunk);
      }
      this.size += bytes;
      callback();
    } catch (err) {
      callback(err as Error);
    }
  }

  _final(callback: (err?: Error | null) => void): void {
    try {
      fs.closeSync(this.fd);
      callback();
    } catch (err) {
      callback(err as Error);
    }
  }
}

/** 创建轮转写入流 */
export function createRotatingStream(opts: RotateOptions): Writable {
  return new RotatingFileStream(opts);
}

/** 读取日志轮转现状 */
export function getLogRotateState(opts: RotateOptions): RotateState {
  const file = path.join(opts.dir, opts.baseName);
  const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
  const { prefix, suffix } = historyPattern(opts);
  const history = fs.existsSync(opts.dir)
    ? fs.readdirSync(opts.dir).filter((name) => name.startsWith(prefix) && name.endsWith(suffix)).length
    : 0;
  return { file, size, maxSizeBytes: opts.maxSizeBytes, maxFiles: opts.maxFiles, history };
}
```

### 密码工具

`src/utils/password.ts`为密码工具，基于 `bcryptjs` 的密码哈希和校验：

```ts
/**
 * ============================================================
 * 密码工具（utils/password.ts）
 * ------------------------------------------------------------
 * 基于 bcryptjs 的密码哈希和校验
 * 安全规范：
 *   - 注册 / 改密时用 hashPassword
 *   - 登录时用 comparePassword 比对，禁止明文比对
 * ============================================================
 */

import bcrypt from "bcryptjs";
import appConfig from "../config/app.config";

/**
 * 密码哈希（注册 / 改密时用）
 * @param plainPassword 明文密码
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, appConfig.bcrypt.saltRounds);
}

/**
 * 密码校验（登录时用）
 * @param plainPassword 明文密码
 * @param hashed 数据库里存的哈希
 */
export async function comparePassword(plainPassword: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashed);
}

/**
 * 密码强度校验（弱口令拦截）
 * 规则：长度 8-32，至少包含字母和数字
 * 可按项目需要放宽/加严（如再要求大小写、特殊字符）
 */
export function checkPasswordStrength(password: string): { valid: boolean; message?: string } {
  if (password.length < 8 || password.length > 32) {
    return { valid: false, message: "password length must be 8-32" };
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return { valid: false, message: "password must contain both letters and digits" };
  }
  return { valid: true };
}
```

### 哈希工具

`src/utils/tokenHash.ts`为哈希工具，防止数据库泄露后 token 被复用：

```ts
/**
 * ============================================================
 * Token 哈希工具（utils/tokenHash.ts）
 * ------------------------------------------------------------
 * Refresh Token 入库前做哈希，防止数据库泄露后 token 被复用
 * ============================================================
 */

import crypto from "crypto";

/**
 * 计算 token 的 SHA-256 哈希
 * @param token 明文 token
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export default hashToken;
```

## 模块组件

### 默认模块

后端框架默认包含鉴权模块、验证码模块、系统参数设置、字典模块、消息通知、操作日志、上传模块、用户模块、角色管理、菜单管理。`prisma`统一管理数据结构，所有数据库结构以`prisma`的配置为核心，`src/prisma/schema.prisma`:

```ts
// ============================================================
// Express + TypeScript 后端框架模板 —— Prisma Schema
// ------------------------------------------------------------
// 设计约定：
// 1. 字段 camelCase，通过 @map 映射数据库 snake_case 列
// 2. 数据库二态：sqlite（默认，零配置）/ mysql（生产）
//    ★ Prisma 7 新架构（Driver Adapters）：
//      - schema 不再写 url（已弃用），连接串只在 prisma.config.ts
//        和 src/db/prisma.ts（运行时 adapter）两处配置
//      - 切 MySQL 步骤：provider 改 "mysql" + DATABASE_URL 换
//        mysql:// 串 + prisma.config.ts 无需改（读同一 env）→
//        npx prisma generate → npx prisma migrate deploy
// 3. 权限模型：完整 RBAC（用户-角色-菜单/权限点-按钮），
//    通过 user_roles / role_menus 关联，User 无冗余 role 字段
// ============================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
}

// ---------------- 用户表 ----------------
model User {
  id           Int       @id @default(autoincrement())
  username     String    @unique
  passwordHash String    @map("password_hash")      // bcrypt 哈希
  realName     String?   @map("real_name") @default("")
  email        String    @default("")  // 邮箱（注册/创建用户必填；NOT NULL，历史数据兜底空串）
  status       Int       @default(1)                // 1 正常 0 禁用
  lastLoginAt  DateTime? @map("last_login_at")
  isDeleted    Int       @map("is_deleted") @default(0)  // 软删除：0 否 1 是
  deletedAt    DateTime? @map("deleted_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  // 关系
  roles         UserRole[]
  refreshTokens RefreshToken[]
  notifications Notification[]
  operationLogs OperationLog[]

  @@map("users")
}

// ---------------- RBAC：角色表 ----------------
model Role {
  id          Int      @id @default(autoincrement())
  code        String   @unique          // 角色编码，如 admin / operator / viewer
  name        String                     // 角色名称，如 管理员
  description String?  @default("")
  status      Int      @default(1)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  users UserRole[]
  menus RoleMenu[]

  @@map("roles")
}

// ---------------- RBAC：菜单/权限表（目录·菜单·按钮三级） ----------------
model Menu {
  id         Int      @id @default(autoincrement())
  parentId   Int      @map("parent_id") @default(0)   // 0 = 顶级
  name       String                                   // 菜单/权限点名称
  type       String   @default("MENU")                // DIR 目录 / MENU 菜单 / BUTTON 按钮
  path       String?  @default("")                    // 前端路由路径
  component  String?  @default("")                    // 前端组件路径
  icon       String?  @default("")
  group      String?  @default("") @map("menu_group") // 菜单分组标识（DIR/MENU 可选；空=前端不渲染该分组；列名避开 MySQL 保留字 GROUP）
  permission String?  @default("")                    // 权限码，如 adminCenter:user:list
  sort       Int      @default(0)
  status     Int      @default(1)
  visible    Int      @default(1)                     // 是否显示在侧边栏：1 显示 0 隐藏（有权限但不出现在菜单）
  isDeleted  Int      @map("is_deleted") @default(0)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  roles RoleMenu[]

  @@map("menus")
}

// ---------------- RBAC：用户-角色关联表 ----------------
model UserRole {
  userId Int @map("user_id")
  roleId Int @map("role_id")
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role   Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@map("user_roles")
}

// ---------------- RBAC：角色-菜单关联表 ----------------
model RoleMenu {
  roleId Int @map("role_id")
  menuId Int @map("menu_id")
  role   Role @relation(fields: [roleId], references: [id], onDelete: Cascade)
  menu   Menu @relation(fields: [menuId], references: [id], onDelete: Cascade)

  @@id([roleId, menuId])
  @@map("role_menus")
}

// ---------------- 系统参数表 ----------------
model SystemConfig {
  id              Int      @id @default(autoincrement())
  configKey       String   @unique @map("config_key")
  configValue     String?  @map("config_value")
  description     String?  @default("")
  editable        Int      @default(1) // 1=可修改 0=锁定
  configScope     String   @default("system") @map("config_scope") // system / super
  configGroup     String   @default("") @map("config_group")
  readScope       String   @default("all") @map("read_scope")      // all / super
  valueType       String   @default("string") @map("value_type")
  defaultValue    String?  @map("default_value")
  validationJson  String?  @default("") @map("validation_json")
  envKey          String?  @default("") @map("env_key")
  restartRequired Int      @default(0) @map("restart_required")
  sort            Int      @default(0)
  status          Int      @default(1)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("system_configs")
}

// ---------------- 操作日志表（业务审计） ----------------
model OperationLog {
  id          Int      @id @default(autoincrement())
  userId      Int?     @map("user_id")
  username    String?  @default("")
  module      String?  @default("")     // 模块名，如 user
  action      String?  @default("")     // 动作，如 创建/更新/删除
  description String?  @default("")
  ip          String?  @default("")
  createdAt   DateTime @default(now()) @map("created_at")

  user User? @relation(fields: [userId], references: [id])

  @@map("operation_logs")
}

// ---------------- 消息通知表 ----------------
model Notification {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  title     String
  content   String
  type      String   @default("info")   // info / warning / error 等
  data      String   @default("{}")     // 扩展数据 JSON 字符串
  isRead    Int      @map("is_read") @default(0)
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@map("notifications")
}

// ---------------- 安全：刷新令牌表 ----------------
model RefreshToken {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  tokenHash String   @map("token_hash")  // 只存哈希，不存明文
  expiresAt DateTime @map("expires_at")
  revoked   Boolean  @default(false)     // 登出/吊销标记
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}

// ---------------- 安全：登录失败记录表 ----------------
// 按用户名记录（登录时用户可能不存在，故不关联 User 表）
model LoginAttempt {
  id            Int       @id @default(autoincrement())
  username      String
  failedCount   Int       @map("failed_count") @default(0)
  lockedUntil   DateTime? @map("locked_until")   // 锁定截止时间，null 未锁定
  lastAttemptAt DateTime? @map("last_attempt_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  @@index([username])
  @@map("login_attempts")
}

// ---------------- 数据字典：字典类型表 ----------------
model DictType {
  id        Int       @id @default(autoincrement())
  typeCode  String    @unique @map("type_code")   // 如 order_status
  typeName  String    @map("type_name")           // 如 订单状态
  status    Int       @default(1)
  remark    String?   @default("")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  data DictData[]

  @@map("dict_types")
}

// ---------------- 数据字典：字典项表 ----------------
model DictData {
  id         Int      @id @default(autoincrement())
  dictTypeId Int      @map("dict_type_id")
  label      String                            // 显示文案，如 已发货
  value      String                             // 存储值，如 2
  sort       Int      @default(0)
  status     Int      @default(1)
  createdAt  DateTime @default(now()) @map("created_at")

  dictType DictType @relation(fields: [dictTypeId], references: [id], onDelete: Cascade)

  @@index([dictTypeId])
  @@map("dict_data")
}

```

### 帮助中心

帮助中心分 **静态 / AI** 双模式，两种模式共用同一数据源 `help_doc` 表（数据在后端数据库，前端文件树、文章内容、图片资源全部走后端网络请求）。

**AI 专有知识库**：帮助文档已从主库剥离，固定存放于独立 SQLite 文件 `data/help.db`（与主库 `DB_TYPE` 解耦，主库切 MySQL 不影响帮助中心；`help:index` / seed 均自动建表）。

**AI 专有知识库**：帮助文档已从主库剥离，固定存放于独立 SQLite 文件 `data/help.db`（与主库 `DB_TYPE` 解耦，主库切 MySQL 不影响帮助中心；`help:index` / seed 均自动建表）。

#### 模式切换

模式（`static` / `ai`）由 `system_configs` 表 `config_key = 'help_mode'` 控制，seed 初始化为 `static`（用户可在系统设置中修改）。前端通过系统设置表单读写该配置即可完成切换（`GET /api/v1/config/all` 读取、`PUT /api/v1/config` 保存）；未配置/值非法时 `GET /api/v1/help/mode` 返回 `30005 帮助模式未配置`。不同模式调用不同接口：

- `static`：`GET /api/v1/help/tree` + `GET /api/v1/help/article` + `GET /api/v1/help/assets/*`
- `ai`：`POST /api/v1/help/chat`（Ollama 生成，不可达/超时自动降级为检索摘要，功能不中断）

#### 接口清单

用户侧（`static` / `ai` 共用）：

| 方法 | 路径                                 | 说明                                                                                              |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| GET  | `/api/v1/help/tree?locale=`          | 文档树（版块→章节→文章），未传 locale 时读 `system_configs.default_locale`；locale 统一小写连字符 |
| GET  | `/api/v1/help/article?locale=&path=` | 文章正文（md 内 `assets/` 图片路径已重写为 `/api/v1/help/assets/`）                               |
| GET  | `/api/v1/help/assets/*`              | md 内图片资源（后端静态托管 `data/help/assets`）                                                  |
| POST | `/api/v1/help/chat`                  | AI 对话 `{ question, locale, history }` → `{ answer, sources }`                                   |
| GET  | `/api/v1/help/mode`                  | 当前帮助模式（`static` / `ai`）                                                                   |
| GET  | `/api/v1/help/ai-health`             | AI 服务健康状态（Ollama 连通性 + 配置模型是否已安装）                                             |

管理端（超级面板 / 知识管理中心）：

| 方法   | 路径                                       | 权限                                                                       |
| ------ | ------------------------------------------ | -------------------------------------------------------------------------- |
| GET    | `/api/v1/help/admin/locales`               | `superAdmin:knowledgeCenter:list`                                          |
| POST   | `/api/v1/help/admin/locales/:locale/init`  | `superAdmin:help:slot:manage`                                              |
| PATCH  | `/api/v1/help/admin/locales/:locale`       | `superAdmin:help:slot:manage`                                              |
| DELETE | `/api/v1/help/admin/locales/:locale`       | `superAdmin:help:slot:manage`                                              |
| GET    | `/api/v1/help/admin/slots`                 | `superAdmin:knowledgeCenter:list`                                          |
| GET    | `/api/v1/help/admin/slots/file-options`    | `superAdmin:help:slot:manage`                                              |
| POST   | `/api/v1/help/admin/slots`                 | `superAdmin:help:slot:manage`                                              |
| PUT    | `/api/v1/help/admin/slots/:docKey`         | `superAdmin:help:slot:manage`                                              |
| DELETE | `/api/v1/help/admin/slots/:docKey`         | `superAdmin:help:slot:manage`                                              |
| GET    | `/api/v1/help/admin/slots/:docKey`         | `superAdmin:knowledgeCenter:list`                                          |
| GET    | `/api/v1/help/admin/slots/:docKey/content` | `superAdmin:knowledgeCenter:list`                                          |
| GET    | `/api/v1/help/admin/slots/:docKey/file`    | `superAdmin:knowledgeCenter:list`                                          |
| PUT    | `/api/v1/help/admin/slots/:docKey/content` | 空槽位 `superAdmin:help:doc:create`，已有文件 `superAdmin:help:doc:update` |
| DELETE | `/api/v1/help/admin/slots/:docKey/content` | `superAdmin:help:doc:delete`                                               |
| POST   | `/api/v1/help/admin/assets`                | `superAdmin:help:doc:update`                                               |
| POST   | `/api/v1/help/admin/reindex`               | `superAdmin:help:reindex`                                                  |
| GET    | `/api/v1/help/admin/index/status`          | `superAdmin:knowledgeCenter:list`                                          |

旧 `GET /api/v1/help/admin/docs`（直接读索引的只读列表）保留兼容。

管理端约定：

- 语言不做后端白名单：`data/help` 下一级目录名即 locale，只校验 `^[a-z]{2,3}(-[a-z0-9]{2,8})?$`；`assets` / `.history` / `.trash` / `.tmp` 自动跳过。
- 每个语言目录必须有 `help.manifest.json`，管理树只按 manifest 枚举；目录内层级、文件名、语言之间可以完全不一致。
- 文档位状态：`published`（文件存在且索引 hash 一致）/ `empty`（manifest 有、文件无）/ `stale`（文件有但 hash 不一致或未索引）；文件有、manifest 无的文件进 `orphans` 单独列表。
- 写正文为 `multipart/form-data`，字段名 `file`；md ≤2MB、pdf ≤20MB，扩展名必须与槽位 `contentType` 一致；带 `baseHash` 且与当前文件 hash 不一致返回 `30012`。
- 覆盖前把原文件复制到 `{locale}/.history/{YYYY-MM-DD}/`；删除槽位/清空内容把文件移到 `{locale}/.trash/{YYYY-MM-DD}/`，两者都不物理删除。
- 删除槽位/清空内容必须传 `confirm=<docKey>`，否则 `30018 HELP_CONFIRM_REQUIRED`。
- 图片上传只接受 png/jpg/jpeg/webp/gif，≤5MB，默认落到 `data/help/assets/{uuid}{ext}`，返回 `url` / `path` / `size` / `mimeType`。
- 未传 locale 时按 `system_configs.default_locale` → 回退 `zh-cn`。`GET /admin/slots` 在目录或 manifest 缺失时返回空树（`manifestExists=false`），按 `docKey` 操作的接口返回 `30010`。
- 语言改名/删除：`PATCH /admin/locales/:locale` body `{ newLocale?, title? }`；改目录名时同步改 `manifest.locale` 并平移 `help_doc.locale`，前端语言包/语言码是否同步由人工确认。`DELETE /admin/locales/:locale?confirm=<locale>` 直接物理删除目录与索引，不保留备份。

#### manifest 格式

`data/help/{locale}/help.manifest.json`：

```json
{
  "schemaVersion": 1,
  "locale": "zh-cn",
  "title": "简体中文",
  "tree": [
    {
      "type": "section",
      "key": "template-10",
      "title": "快速上手",
      "sort": 10,
      "source": "template",
      "children": [
        {
          "type": "chapter",
          "key": "template-10-1",
          "title": "系统介绍",
          "sort": 1,
          "children": [
            {
              "type": "doc",
              "key": "template-10-1-system-introduction",
              "title": "系统介绍",
              "summary": "一句话摘要",
              "sort": 1,
              "file": "template/10-快速上手/01-系统介绍.md",
              "contentType": "md"
            }
          ]
        }
      ]
    }
  ]
}
```

- `section.children` 只能是 chapter 或 doc，不能混排；`key` 在整份 manifest 内全局唯一。
- `file` 相对 locale 目录，posix 写法，禁止 `..`、绝对路径、盘符和空段；扩展名决定 `contentType`，必须与声明一致。
- `path` 可省略，省略时由 `file` 去扩展名生成；显式给出时作为用户侧文章 path（相对 source 根目录）。
- 新增语言只需：前端加语言包 → 建 `data/help/{locale}/` → 放 `help.manifest.json` → 执行索引或 `POST /admin/reindex`；后端不需要新增常量、白名单或代码分支。

#### 文档投喂

1. 在 `data/help/{locale}/` 下按 manifest 的 `file` 放 `.md` / `.pdf`；文件名和中间目录可以任意，只要与 manifest 一致。
2. md 文件头 frontmatter 写 `title`（可选，manifest 优先）、`summary`（可选，空时取 frontmatter）；正文图片用 `assets/xxx.png`，资源放 `data/help/assets/`。
3. pdf 用 `pdf-parse` 提取正文：摘要取前 300 字、正文入库前 20000 字。
4. 执行 `npm run help:index` 或 `POST /api/v1/help/admin/reindex` → 同一事务内“清空 + 整片写入” `help_doc`；收集到 0 篇时直接返回，不误清已有索引；并发重建返回 `30015`。
5. 新增/修改/删除文件后重跑一次索引即可；管理端上传/覆盖正文会同时更新文件与索引，不需要再手工重跑。

#### 错误码

| 错误码 | 常量                     | 含义                                               |
| ------ | ------------------------ | -------------------------------------------------- |
| 30010  | `HELP_LOCALE_NOT_FOUND`  | 语言目录或 manifest 不存在                         |
| 30011  | `HELP_SLOT_NOT_FOUND`    | 文档位不存在                                       |
| 30012  | `HELP_DOC_CONFLICT`      | 文档位/文件/路径冲突，或基线已变化                 |
| 30013  | `HELP_PATH_INVALID`      | 文件或文章路径非法                                 |
| 30014  | `HELP_MANIFEST_INVALID`  | manifest 结构非法                                  |
| 30015  | `HELP_INDEX_BUSY`        | 索引重建进行中或索引写入失败                       |
| 30016  | `HELP_FILE_NOT_FOUND`    | 文档文件不存在                                     |
| 30017  | `HELP_SLOT_HAS_CHILDREN` | 文档位仍有子节点，不能删除                         |
| 30018  | `HELP_CONFIRM_REQUIRED`  | 删除类操作缺少 `confirm=docKey` / `confirm=locale` |
| 30019  | `HELP_LOCALE_CONFLICT`   | 目标语言目录已存在                                 |

#### 跨库说明

检索不依赖 FTS5：查询词构造（整句 + 分隔拆词 + 中文双字滑窗，≤20 词）→ 跨库通用 `LIKE`（% \_ 转义）→ JS 评分（命中词 title×3 / summary×2 / content×1 累加，取 top3），SQLite / MySQL 行为一致。`help_doc` 表在原有索引字段上新增 `section_key` / `chapter_key` / `doc_key` / `content_hash` / `file_size` / `file_mtime` / `indexed_at`，并用 `(locale, doc_key)` 部分唯一索引约束文档位；Prisma 版见 `prisma/schema.prisma` 的 `model HelpDoc`，手写 SQL 版见 `scripts/schema.sqlite.sql` 与 `scripts/schema.mysql.sql`（旧库由 `helpDb.ts` 启动时逐列补齐）。

#### 环境变量

| 变量              | 默认值                   | 说明                         |
| ----------------- | ------------------------ | ---------------------------- |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama 服务地址              |
| `OLLAMA_MODEL`    | `qwen2.5:7b`             | 对话模型（服务器已装）       |
| `OLLAMA_TIMEOUT`  | `60`                     | 调用超时（秒），超时自动降级 |
| `HELP_DATA_DIR`   | `./data/help`            | 文档投喂目录                 |

### 聚合文件

`src/types/index.ts`为聚合文件：

```ts
/** 数据类型 */
// export * from "./";
```

### 类型扩展

`src/types/express.d.ts`为Express 类型扩展文件：

```ts
/**
 * ============================================================
 * Express 类型扩展（types/express.d.ts）
 * ------------------------------------------------------------
 * 声明 req.user / res.success / res.error 等自定义属性
 * ============================================================
 */

import "express";

declare global {
  namespace Express {
    interface Request {
      /** 登录用户信息（由 auth 中间件挂载） */
      user?: {
        userId: number;
        username: string;
        type?: "access" | "refresh";
        [key: string]: any;
      };
    }

    interface Response {
      /** 成功响应 */
      success: (data?: any, msg?: string, code?: number) => void;
      /** 失败响应 */
      error: (error: string | number, code?: number) => void;
    }
  }
}

export {};
```

### 验证类型

`src/types/svg-captcha.d.ts`为`svg-captcha` 类型声明文件：

```ts
/**
 * ============================================================
 * svg-captcha 类型声明（svg-captcha.d.ts）
 * ------------------------------------------------------------
 * svg-captcha 没有官方 @types，自己写一个 shim
 * ============================================================
 */

declare module "svg-captcha" {
  interface CaptchaOptions {
    size?: number; // 验证码长度
    fontSize?: number; // 字体大小
    width?: number; // 图片宽度
    height?: number; // 图片高度
    ignoreChars?: string; // 排除的字符
    noise?: number; // 干扰线条数
    color?: boolean; // 是否彩色
    background?: string; // 背景色
  }

  interface CaptchaResponse {
    data: string; // SVG 字符串
    text: string; // 验证码答案
  }

  function createCaptcha(options?: CaptchaOptions): CaptchaResponse;

  export = createCaptcha;
}
```

> `svg-captcha` 没有官方 `@types`，自己写一个 `shim`

## 前端指南

### 响应格式

所有接口统一返回 `{ code, msg, data, timestamp }`，msg 永远是字符串代码标识（如 `SUCCESS` / `USER_NOT_EXIST` / `PARAM_INVALID:username`），所有接口返回统一结构，前端拦截器按 `code` 判断成功失败：

```typescript
// axios 响应拦截器示例
service.interceptors.response.use((response) => {
  const res = response.data;
  if (res.code === 200) {
    return res.data; // 成功，直接返回 data
  } else {
    // 失败，按 code 映射多语言提示
    const message = i18n.global.t(`error.${res.msg}`);
    ElMessage.error(message);
    return Promise.reject(res);
  }
});
```

> 所有的详细数据/请求响应类型参考具体`API`接口定义

### 鉴权方式

登录成功后拿到 `token`，后续请求在请求头携带：

```typescript
// axios 请求拦截器
service.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### 验证登录

```
1. 打开登录页 → 调用 GET /api/captcha 获取验证码
2. 前端渲染 img 字段（SVG 字符串）
3. 用户输入验证码 → 提交 POST /api/auth/login
4. 参数：{ username, password, captchaId, captchaCode }
5. 登录成功 → 保存 token，跳转首页
```

### 国际映射

#### 数据格式

后端不返回自然语言文案，前端拿 `code / msg`做 `i18n key` 渲染多语言：

```typescript
// 前端语言包示例（zh-CN）
export default {
  error: {
    SUCCESS: "操作成功",
    PARAM_INVALID: "参数格式不正确",
    UNAUTHORIZED: "请先登录",
    TOKEN_EXPIRED: "登录已过期，请重新登录",
    TOKEN_INVALID: "登录状态无效",
    PERMISSION_DENIED: "权限不足",
    USER_NOT_EXIST: "用户不存在",
    USER_PASSWORD_ERROR: "用户名或密码错误",
    CAPTCHA_EXPIRED: "验证码已过期",
    CAPTCHA_ERROR: "验证码错误",
    // ... 更多错误码按需补充
  },
  common: {
    CREATE_SUCCESS: "创建成功",
    UPDATE_SUCCESS: "更新成功",
    DELETE_SUCCESS: "删除成功",
  },
};
```

```typescript
// 前端语言包示例（en-US）
export default {
  error: {
    SUCCESS: "Success",
    PARAM_INVALID: "Invalid parameters",
    UNAUTHORIZED: "Please login first",
    TOKEN_EXPIRED: "Login expired, please login again",
    // ...
  },
  common: {
    CREATE_SUCCESS: "Created successfully",
    UPDATE_SUCCESS: "Updated successfully",
    DELETE_SUCCESS: "Deleted successfully",
  },
};
```

#### 数据约定

| 约定     | 说明                                                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 权威源   | 错误标识/码 → `src/constants/errorCode.ts`（`ERROR_CODE` + `GLOBAL_ERROR_MAP` + `CODE_TO_MSG`）；成功标识 → `src/constants/messageCode.ts`          |
| 前端字典 | `docs/i18n-codes.json`（msg → code + 中/英文文案），前端 import 即得 i18n 基座                                                                      |
| 规范文档 | `docs/响应码字典.md`（完整字典 + 前端解析示例）                                                                                                     |
| 三种返回 | 成功 `this.ok(data, msg?)`；主动失败 `this.fail(ERROR_CODE.XXX)`（msg 自动补全）；Joi 失败 `this.failJoi(error)`（自动转 `PARAM_INVALID:<字段名>`） |
| 业务错误 | service 里 `throw new Error("USER_NOT_EXIST")`，errorHandler 自动映射 code + 同一 msg                                                               |

#### 分页查询

以下为分页查询的前端调用示例：

```typescript
// 响应：
{
  "code": 200,
  "msg": "SUCCESS",
  "data": {
    "list": [{ id: 1, name: "张三", ... }],
    "total": 100,
    "page": 1,
    "pageSize": 10
  }
}
```

### 菜单权限

后端具有`RBAC`用户-角色-菜单/权限点-按钮 五表模型，也可在后端配置组件路径，图表展示，禁用菜单等等，涉及到的配置需要在后端数据库配置，显示菜单在`seed.ts`数据种子文件中生成或单独配置。

### 文件上传

以下为文件上传的前端调用示例：

```typescript
// 上传文件
const formData = new FormData();
formData.append("file", file);

await axios.post("/api/upload/file", formData, {
  headers: { "Content-Type": "multipart/form-data" }
});

// 响应：
{
  "code": 200,
  "msg": "UPLOAD_SUCCESS",
  "data": {
    "url": "/uploads/xxx.jpg",
    "originalName": "photo.jpg",
    "size": 102400
  }
}
```

## 项目授权

本项目基于 MIT 许可证开源。

### 许可范围

- ✅ 商业使用（可用于商业产品及产品销售）
- ✅ 修改
- ✅ 分发
- ✅ 私人使用
- ✅ 分许可

### 限制说明

- ⚠️ 无担保：作者不对使用本软件造成的任何损失承担责任。
- ⚠️ 必须保留版权与许可证声明。
- ⚠️ 不授予使用原作者商标或项目名称的相关权利。
- ⚠️ 本项目的依赖包拥有各自独立的开源许可证，请单独核查每个依赖。
