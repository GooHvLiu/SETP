/**
 * 构建后路径别名重写（scripts/rewrite-aliases.cjs）
 * ------------------------------------------------------------
 * tsc 不会改写 tsconfig paths。生产构建把 @src/@routes/@root
 * 替换成相对 dist 的路径，避免运行时再去读 src 源码目录。
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

const aliases = {
  "@src": path.join(dist, "src"),
  "@routes": path.join(dist, "routes"),
  "@root": dist,
};

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function toRelative(file, target) {
  let rel = path.relative(path.dirname(file), target).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

function rewrite(file) {
  if (!file.endsWith(".js")) return;
  const source = fs.readFileSync(file, "utf8");
  const result = source.replace(/(require\(\s*["'])(@(?:src|routes|root)(?:\/[^"']*)?)(["']\s*\))/g, (all, open, spec, close) => {
    const [alias, ...rest] = spec.split("/");
    const base = aliases[alias];
    if (!base) return all;
    const suffix = rest.join("/");
    const target = suffix ? path.join(base, suffix) : base;
    return `${open}${toRelative(file, target)}${close}`;
  });

  if (result !== source) fs.writeFileSync(file, result, "utf8");
}

for (const file of walk(dist)) rewrite(file);
console.log("✅ 已重写构建产物路径别名");
