/**
 * 手写路由契约采集。
 * TSOA 只覆盖 controller 路由，Express Router 手写路由必须单独留快照，
 * 避免「接口存在但 OpenAPI 查不到」的契约缺口。
 */
import fs from "node:fs";
import path from "node:path";

/** 参与契约快照的手写路由文件（相对项目根目录） */
export const MANUAL_ROUTE_FILES = [
  "src/modules/auth/auth.recovery.route.ts",
  "src/modules/config/superSettings.batch.route.ts",
  "src/modules/help/help.admin.route.ts",
  "src/modules/mail/mail.route.ts",
  "routes/healthRouter.ts",
];

export interface ManualRoute {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  source: string;
  /** 路由声明后是否紧跟 requireAuth（仅用于契约可读性） */
  auth: boolean;
}

/** 从源码中提取 router.<method>("<path>")，支持跨行写法 */
export function collectManualRoutes(root: string): ManualRoute[] {
  const routes: ManualRoute[] = [];
  for (const file of MANUAL_ROUTE_FILES) {
    const absolute = path.join(root, file);
    const source = fs.readFileSync(absolute, "utf8");
    const pattern = /router\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const start = match.index;
      const tail = source.slice(start, start + 600);
      routes.push({
        method: match[1] as ManualRoute["method"],
        path: match[2],
        source: file,
        auth: /requireAuth|requirePermission|requireSlotContentPermission/.test(tail),
      });
    }
  }
  return routes.sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`));
}
