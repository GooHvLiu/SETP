# 文档索引

本目录存放公开文档。根目录 README 负责快速开始；这里负责文档导航和维护约定。

## 入口

- [项目 README](../README.md)
- [贡献指南](../CONTRIBUTING.md)
- [安全策略](../SECURITY.md)
- [变更记录](../CHANGELOG.md)
- [接口契约](api/openapi.json)
- [手写路由快照](api/manual-routes.json)

## 维护约定

- 公开文档必须随代码提交，不把 `*.md` 加入 `.gitignore`。
- 必须跟踪：`README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`SECURITY.md`、`CODE_OF_CONDUCT.md`、`LICENSE`，以及 `docs/` 下的公开文档。
- 个人草稿放 `docs/private/`，并把 `docs/private/` 写入 `.git/info/exclude`；不要提交到仓库。
- 已跟踪但不希望继续公开的文件，用 `git rm --cached <file>` 停止跟踪，再写入忽略规则；历史提交仍保留内容。
- 如果历史内容含真实密钥、密码或客户数据，按泄露处理：先轮换密钥，再评估是否用 `git filter-repo` 清理历史。
