/**
 * 校验 package-lock.json 的 resolved 地址只指向 npm 官方源。
 * 公开模板的锁文件不能写入本地镜像地址，否则外部用户执行 npm ci 时会被指向第三方镜像。
 */
import fs from "node:fs";
import path from "node:path";

const officialHost = "registry.npmjs.org";
const lockPath = path.join(process.cwd(), "package-lock.json");

interface LockEntry {
  resolved?: string;
}

interface LockFile {
  packages?: Record<string, LockEntry>;
}

const lock = JSON.parse(fs.readFileSync(lockPath, "utf8")) as LockFile;
const invalid: string[] = [];

for (const [packageName, entry] of Object.entries(lock.packages ?? {})) {
  if (!entry.resolved) continue;

  let url: URL;
  try {
    url = new URL(entry.resolved);
  } catch {
    invalid.push(`${packageName}: ${entry.resolved}`);
    continue;
  }

  if (url.protocol !== "https:" || url.hostname !== officialHost) {
    invalid.push(`${packageName}: ${entry.resolved}`);
  }
}

if (invalid.length > 0) {
  console.error(`[lockfile:check] 发现 ${invalid.length} 个非 npm 官方源地址：`);
  for (const item of invalid.slice(0, 10)) console.error(`  ${item}`);
  if (invalid.length > 10) console.error(`  ...还有 ${invalid.length - 10} 个`);
  console.error("[lockfile:check] 请把 resolved 统一为 https://registry.npmjs.org 后提交");
  process.exit(1);
}

console.log("[lockfile:check] package-lock.json 仅使用 npm 官方源");
