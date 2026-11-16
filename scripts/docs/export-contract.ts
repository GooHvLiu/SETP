/**
 * 导出接口契约快照与错误码清单。
 * 生成物：docs/api/openapi.json、docs/api/error-codes.json
 * 用法：npm run contract:export
 */
import fs from "node:fs";
import path from "node:path";

import { ERROR_CODE, ERROR_DESC } from "../../src/constants/errorCode";
import { collectManualRoutes } from "./manual-routes";

const root = process.cwd();
const swaggerPath = path.join(root, "src/swagger/swagger.json");
const docsDir = path.join(root, "docs/api");

const swagger = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));

const errorCodes = Object.entries(ERROR_CODE).map(([name, code]) => ({
  name,
  code,
  description: ERROR_DESC[name] ?? "",
}));

const manualRoutes = collectManualRoutes(root);

fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, "openapi.json"), `${JSON.stringify(swagger, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(docsDir, "error-codes.json"), `${JSON.stringify(errorCodes, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(docsDir, "manual-routes.json"), `${JSON.stringify(manualRoutes, null, 2)}\n`, "utf8");

console.log(`[contract] OpenAPI paths: ${Object.keys(swagger.paths ?? {}).length}`);
console.log(`[contract] Manual routes: ${manualRoutes.length}`);
console.log(`[contract] Error codes: ${errorCodes.length}`);
console.log("[contract] docs/api/openapi.json、error-codes.json、manual-routes.json 已更新");
