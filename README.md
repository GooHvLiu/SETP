# SETP 后端模板

> Express + TypeScript + Prisma + TSOA 后端框架模板，开箱即用的完整工程化模板。

[![CI](https://github.com/GooHvLiu/Setp/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/GooHvLiu/Setp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.19-339933)](package.json)

## 快速开始

**方式一：本机 MySQL（默认）**

```bash
cp .env.example .env       # 默认 DB_TYPE=mysql
# 修改 DATABASE_URL 为实际 MySQL 地址，并提前建空库
npm ci
npm start                  # init → db:prepare → 生产构建 → node dist/app.js
# API: http://localhost:3000
# Swagger: http://localhost:3000/api-docs（NODE_ENV=production 时关闭）
```

默认管理员 `admin / 123456`，超级管理员 `superAdmin / superAdmin123456@`；正式部署前必须通过 `.env` 或 Compose 环境变量替换。

> 迁移或复制项目时只复制源码与 `package*.json`，不要复制 `node_modules`。Windows 下旧目录里的锁定文件会让 `npm install` 清理阶段报 `EPERM`；到新目录后重新执行 `npm install` 即可。

**方式二：SQLite 零配置体验**

```bash
npm ci
npm run db:rebuild   # 没有 .env 时自动按 SQLite 生成
npm start
```

**方式三：Docker Compose**

Compose 需要 `MYSQL_ROOT_PASSWORD`、`MYSQL_PASSWORD`、`JWT_SECRET`、`CONFIG_SECRET_KEY`、管理员密码等变量；Docker 使用 `.env.docker`（已被 `.gitignore` 忽略），首次使用从 `.env.example` 复制并替换占位值。

`better-sqlite3` 在 Alpine 上无预编译包时会回退源码编译。默认从 `nodejs.org` 下载 Node 头文件；国内网络可在 `.env.docker` 增加 `NODE_DIST_URL=https://npmmirror.com/mirrors/node`，Compose 会把它作为构建参数传入。

本机安装时，`.npmrc` 已把 `better-sqlite3` 的预编译包地址指向 npmmirror；Node 20 / 22 / 24 会直接下载对应 ABI 的预编译包，不需要本机安装 Visual Studio C++。海外网络环境可删除该行，改回 GitHub Release。

```bash
cp .env.example .env.docker   # 只改 Docker 必填项：MYSQL_*、JWT_SECRET、CONFIG_SECRET_KEY、ADMIN_*
docker compose --env-file .env.docker up -d --build
curl -fsS http://localhost:3000/ready
```

一键切库只改 `DB_TYPE` 与 `DATABASE_URL` 两项，不改 schema、不改迁移目录、不改代码。

> 首次运行没有 `.env` 时，`npm run db:rebuild` 会自动按 SQLite 零配置生成；需要 MySQL 时，先从 `.env.example` 复制 `.env` 并配置 `DATABASE_URL`，再执行重建。

## 数据内容

SETP 后端匹配 V3TM 前端，数据库内字段采用国际化配置字段，在实际使用时，需要修改种子数据内容。

## 工程化命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` / `npm start` | 开发监听 / 生产构建后启动（`start` 会先执行 init、db:prepare、build） |
| `npm run build` / `start:prod` | tsc 生产构建（含别名重写）/ 运行 `dist/app.js` |
| `npm run test:unit` | Vitest + Supertest 进程内 HTTP 测试（不含覆盖率） |
| `npm run test:ci` | 契约 + RBAC + 运维自检 + 覆盖率（CI 使用） |
| `npm run test:coverage` | 生成覆盖率报告（`coverage/`），低于门槛直接失败 |
| `npm run db:prepare` | 生成 Client → 应用主库迁移与 help.db 迁移 → 空库自动灌种子 |
| `npm run config:seal` | 把历史明文敏感配置补加密为 `enc:v1:`（需配置 `CONFIG_SECRET_KEY`，可重复执行） |
| `npm run help:index` | 重建帮助中心全文索引（先执行 help.db 迁移） |
| `npm run db:drift` | 对比真实库与当前 `DB_TYPE` 的 schema，存在漂移时退出 1 |
| `npm run backup` | 备份主库 + `data/help.db` + `data/help` 为 bundle 目录，按 `BACKUP_KEEP` 保留份数 |
| `npm run restore -- --file <备份> --yes` | 恢复主库与帮助中心；SQLite 覆盖前自动留 `.before-restore` 副本 |
| `npm run test:api` | 启动服务后的 57 项全量 HTTP 冒烟 |
| `npm run check` | `typecheck` + `lint` + `format:check` |
| `npm run contract:export` / `contract:check` | 导出 / 校验 OpenAPI、错误码与手写路由快照 |
| `npm run gen:module -- <name>` | 生成 controller/service/model/schema + service 单测骨架 |

完整命令见上表；接口契约见下方“接口契约”；贡献流程与安全策略见 [`CONTRIBUTING.md`](CONTRIBUTING.md) 与 [`SECURITY.md`](SECURITY.md)。历史技术笔记见 [`docs/reference/technical-spec.md`](docs/reference/technical-spec.md)（仅历史参考，不再维护正文）。


## 新增与增强能力（0.5.0）

| 领域 | 能力 | 状态 |
| --- | --- | --- |
| 认证与账号 | Access + Refresh 双令牌、会话表校验、**Refresh 一次性轮换 + 重放吊销全部会话**、登出吊销全部会话、重置密码后 `tokenVersion+1` | 已实测 |
| 账号安全 | 密码 8–32 位且至少 3 类字符、注册审批、`mustChangePassword` 强制改密门禁、登录失败锁定、忘记密码 | 已实测 |
| RBAC | 用户-角色-菜单/按钮五表模型、65 项菜单种子、角色层级、菜单软删/恢复、隐藏超级管理员账号、越权统一 403 + `10104` | 已实测 |
| 配置中心 | `system` / `super` 双域读写、46 项运行参数、`editable` / `sensitive` / `envKey`、敏感值 AES-256-GCM、批量保存 | 已实测 |
| 通知与邮件 | 站内通知与已读状态、邮件模板、SMTP 发送、IMAP 收件、发送日志、测试发信、忘记密码邮件 | 已落地，真实邮箱待联调 |
| 帮助中心 | 多语言文档空间、文档位管理、Markdown / PDF 正文、原文件读取、全文索引与重建、manifest 清单 | 已落地，管理端 HTTP 已实测 |
| 运维与观测 | `/live` 与 `/ready` 分离、健康检查、运行指标、会话中心、操作日志、日志轮转、会话清理 / 索引重建 / 数据库 bundle 备份 / `reseed` | 已落地，备份逻辑有单元用例覆盖 |
| API 契约 | 77 个 TSOA 端点 + 25 条手写路由独立快照、统一响应与 `requestId`、93 条错误码、OpenAPI / 错误码漂移校验 | 已实测 |
| 工程化 | 一键双库切换、双库基线迁移、`createApp()` 零副作用、ESLint controller 禁触库、`withTransaction()`、模块生成器自带测试骨架 | 已实测 |
| 交付与治理 | 三种启动方式、`docs/` 文档目录、MIT LICENSE、CONTRIBUTING、SECURITY、CHANGELOG、CODE_OF_CONDUCT、Dependabot、CodeQL、三库 CI 矩阵 | 配置已就绪；实际结果以 CI 运行记录为准 |

## 质量检查

提交前至少执行 `npm run check` 与 `npm run contract:check`；涉及数据库、认证或接口的改动，再执行对应测试。

CI 配置见 `.github/workflows/ci.yml`，运行结果以 Actions 记录为准。

## 已知限制

- Docker Compose 的使用方式见“快速开始”；CI 包含独立的 Docker 镜像构建、容器启动、`/ready` 与 `db:drift` job，实际结果以 Actions 运行记录为准。
- SMTP / IMAP 与 PDF 解析依赖真实邮箱和文档环境，模板完成接口与配置验证，生产接入前需按实际环境回归。
- 覆盖率门槛已写入 `vitest.config.mts`（行/语句/函数 ≥70%，分支 ≥60%）；未达标时 `test:coverage` 直接失败。
- 存量库升级前请先备份，再按 `prisma/migrations` 的顺序执行迁移。

## 接口契约

| 文件 | 内容 |
| --- | --- |
| [`docs/api/openapi.json`](docs/api/openapi.json) | TSOA 生成的 OpenAPI 快照 |
| [`docs/api/manual-routes.json`](docs/api/manual-routes.json) | 手写路由快照 |

两个快照由 `npm run contract:check` 校验；接口变更后执行 `npm run contract:export` 更新。

## 模板密码

本模板为了开箱即用，保留固定默认口令；这些值只用于模板初始化和本地联调，不是生产安全配置。正式项目必须替换后再部署。

| 账号/场景 | 默认值 | 代码/配置位置 | 说明 |
| --- | --- | --- | --- |
| 管理员账号 | `admin / 123456` | `.env` 的 `ADMIN_USERNAME` / `ADMIN_PASSWORD`，默认值见 `src/constants/password.ts` | seed 初始化管理员 |
| 超级管理员 | `superAdmin / superAdmin123456@` | `.env` 的 `SUPER_ADMIN_PASSWORD`，默认值见 `src/constants/password.ts` | seed 初始化隐藏账号 |
| 管理员重置用户密码 | `123456` | `.env` 的 `ADMIN_RESET_PASSWORD`，默认值见 `src/constants/password.ts` | 重置后 `mustChangePassword=1`，首次登录强制改密 |

- 模板阶段允许在常量、`.env.example` 和本文档中保留明文；数据库只保存 bcrypt 哈希。
- 正式项目至少修改 `ADMIN_USERNAME`、`ADMIN_PASSWORD`、`SUPER_ADMIN_PASSWORD`、`ADMIN_RESET_PASSWORD` 四项。
- 默认账号只在首次 seed 时创建；已有库重复执行 seed 不会覆盖已有账号的用户名和密码。
- 未修改默认口令直接上线，等同于公开后台入口；这是模板默认值，不是安全承诺。

## 许可证

本项目使用 MIT License，详见 [LICENSE](LICENSE)。
