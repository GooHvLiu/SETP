# 安全策略

## 支持范围

当前维护 `main` 分支与 SETP 后端模板 `0.5.x` 及之后的版本；历史版本仅提供升级建议。

## 报告漏洞

请**不要**通过公开 Issue 披露安全问题。优先使用仓库 **Security → Report a vulnerability** 的私密报告入口；若该入口未开通，请先联系维护者开通，再提交以下信息：

- 影响版本 / 提交
- 复现步骤或 PoC
- 影响面与建议修复

我们会在 7 个工作日内确认，修复后同步 `CHANGELOG.md`。请给修复窗口，不要提前公开细节。

## 安全基线

本模板的认证、RBAC、限流、密钥、上传与日志脱敏说明以 README 和当前代码为准。

依赖审计以生产依赖为准：

```bash
npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org
```

CI 在安装后执行同一命令，high / critical 直接阻断。

## 安全更新

安全修复优先进入 `main`，并在 `CHANGELOG.md` 的 `Security` 或 `修复` 段说明影响范围与升级方式。涉及密钥、认证或权限模型的改动，合并前必须通过 `npm run test:ci` 与三库 CI 矩阵。
