## 变更内容

<!-- 一句话说明改了什么，以及为什么改。 -->

## 影响面

- [ ] 接口契约（OpenAPI / 手写路由快照）
- [ ] 数据库 schema / migration
- [ ] 权限码或 seed 数据
- [ ] 环境变量
- [ ] 前端契约（字段 / 错误码 / 状态码）

## 验证

<!-- 贴出实际执行过的命令和结果，不要只写“已测试”。 -->

- [ ] `npm run check`
- [ ] `npm run contract:check`
- [ ] `npm run test:ci`
- [ ] 三库矩阵（SQLite / MySQL 8.0 / MariaDB 10.6）

## 风险与回滚

<!-- 是否含不可逆迁移？回滚步骤是什么？ -->

## 检查清单

- [ ] 新增错误码已同步 `ERROR_DESC`
- [ ] 新增接口已进入 OpenAPI 或 `docs/api/manual-routes.json`
- [ ] 新增模块带 `.test.ts`
- [ ] 未提交真实密钥、token、生产数据
