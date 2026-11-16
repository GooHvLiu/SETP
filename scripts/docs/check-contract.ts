/**
 * 校验当前生成的 OpenAPI 是否与 docs/api/openapi.json 快照一致。
 * CI 在 npm run tsoa 之后执行，接口契约变更必须显式更新快照。
 */
import fs from "node:fs";
import path from "node:path";
import { collectManualRoutes } from "./manual-routes";

const root = process.cwd();
const currentPath = path.join(root, "src/swagger/swagger.json");
const snapshotPath = path.join(root, "docs/api/openapi.json");
const manualSnapshotPath = path.join(root, "docs/api/manual-routes.json");

if (!fs.existsSync(snapshotPath)) {
  console.error("[contract:check] 缺少 docs/api/openapi.json，请先执行 npm run contract:export");
  process.exit(1);
}
if (!fs.existsSync(manualSnapshotPath)) {
  console.error("[contract:check] 缺少 docs/api/manual-routes.json，请先执行 npm run contract:export");
  process.exit(1);
}

const current = JSON.stringify(JSON.parse(fs.readFileSync(currentPath, "utf8")));
const snapshot = JSON.stringify(JSON.parse(fs.readFileSync(snapshotPath, "utf8")));
const manualCurrent = JSON.stringify(collectManualRoutes(root));
const manualSnapshot = JSON.stringify(JSON.parse(fs.readFileSync(manualSnapshotPath, "utf8")));

if (current !== snapshot) {
  console.error("[contract:check] OpenAPI 契约已变化，请执行 npm run contract:export 并提交快照");
  process.exit(1);
}
if (manualCurrent !== manualSnapshot) {
  console.error("[contract:check] 手写路由契约已变化，请执行 npm run contract:export 并提交快照");
  process.exit(1);
}

console.log("[contract:check] OpenAPI 快照一致");
console.log("[contract:check] 手写路由快照一致");
