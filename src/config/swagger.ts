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
  "code": 200,                 // 业务码，200 表示成功（见第 4 节错误代码）
  "msg": "SUCCESS",            // 消息标识，前端按标识映射多语言（见第 5 节）
  "params": { "field": "email" }, // 可选：i18n 插值参数，不含自然语言
  "data": {},                  // 返回数据；失败时为 null 或执行记录
  "timestamp": 1728624000000,  // 服务器时间戳（毫秒）
  "requestId": "req-xxx"       // 可选：请求追踪 ID，同时写入 X-Request-ID 响应头
}
\`\`\`

- 成功时 HTTP 状态固定 200；失败时 HTTP 状态按业务语义返回（400 / 401 / 403 / 404 / 409 / 413 / 415 / 422 / 429 / 500 / 502 / 503 / 504）。
- 后端不返回中文文案；\`msg\` 是稳定标识，\`params\` 只放插值参数，由前端 i18n 渲染。
- 业务结果以 \`code\` 为准，HTTP 状态用于网关、监控和客户端统一错误分类。

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
