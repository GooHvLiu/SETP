# express-prisma-tsoa

> 状态：历史参考。本文只保留索引作用，不再维护具体实现细节；当前行为以代码、README 和接口契约为准。
>
> 最后核对：2026-11-16。

## 为什么不再维护正文

早期版本记录的是模板演进过程中的技术方案，包含已经调整过的目录结构、数据库切换方式、环境变量、接口清单和测试口径。继续维护会与当前实现产生偏差，因此不再保留旧正文。

## 当前权威来源

| 内容 | 位置 |
| --- | --- |
| 安装、启动、Docker、环境变量与常用命令 | [`README.md`](../../README.md) |
| 环境变量模板 | [`.env.example`](../../.env.example) |
| 后端模块与目录结构 | [`src/modules`](../../src/modules)、[`src/config`](../../src/config) |
| 数据模型与迁移 | [`prisma/schema.prisma`](../../prisma/schema.prisma)、[`prisma/migrations`](../../prisma/migrations) |
| 接口契约快照 | [`docs/api/openapi.json`](../api/openapi.json)、[`docs/api/manual-routes.json`](../api/manual-routes.json) |
| 测试与质量检查 | `test/`、`package.json` 中的 `check`、`test:ci`、`contract:check` |
| 贡献与安全策略 | [`CONTRIBUTING.md`](../../CONTRIBUTING.md)、[`SECURITY.md`](../../SECURITY.md) |

## 维护约定

- 新增或调整实现时，只更新上表中的权威文件，不再把实现细节回写到本文。
- 接口变更后执行 `npm run contract:export`，并提交 `docs/api` 下的契约快照。
- 需要查阅历史方案时，以 Git 历史为准。
