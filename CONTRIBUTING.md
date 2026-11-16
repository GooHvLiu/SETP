# 贡献指南

## 仓库范围

本仓库是 SETP 后端模板的独立开源仓库。提交前请确认改动只影响后端模板本身，不要把其他项目或前端仓库的改动混入本仓库。

## 开发约定

- 包管理器统一使用 npm，锁文件以 `package-lock.json` 为准，CI 使用 `npm ci`。
- 提交前在仓库根目录执行 `npm run db:generate && npm run check && npm run contract:check && npm run test:ci`。
- 新增接口必须进入 OpenAPI 或 `docs/api/manual-routes.json` 快照；新增错误码必须同步 `ERROR_DESC`。
- 数据库结构变更必须同时提供 SQLite 与 MySQL 迁移，并保证 `npm run db:drift` 无差异。
- 不提交生成的 `src/routes/routes.ts`、`src/swagger/swagger.json`、`prisma/schema.mysql.prisma`；`docs/api/*.json` 属于契约快照，必须提交。
- 不提交真实密钥、token、生产数据和本地数据库文件。

## 提交规范

提交信息使用 `<type>(<scope>): <subject>`，例如 `fix(auth): 刷新令牌重复消费后吊销会话`。一个提交只做一件可验证的事，不在同一提交里混入格式化噪音。

## 合并要求

- CI 三库矩阵（SQLite / MySQL 8.0 / MariaDB 10.6）必须全绿。
- 安全审计 high / critical 必须为零。
- 涉及行为变更时同步更新 `CHANGELOG.md` 与相关 `docs/`。
- 合并前填写 PR 模板中的影响面、验证命令与回滚方式。
