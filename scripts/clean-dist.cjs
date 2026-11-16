/**
 * 清理生产构建目录（scripts/clean-dist.cjs）
 * 只删除项目根目录下的 dist，避免误删其他路径。
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.resolve(root, "dist");

if (path.dirname(dist) !== root) {
  throw new Error("dist 路径越界");
}

fs.rmSync(dist, { recursive: true, force: true });
console.log("✅ 已清理 dist");
