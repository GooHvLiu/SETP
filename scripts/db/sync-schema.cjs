/**
 * 从 SQLite 模型源生成 MySQL schema。
 *
 * 唯一手写源：prisma/schema.prisma
 * 生成产物：prisma/schema.mysql.prisma
 *
 * 禁止手改生成产物；模型变更后执行 npm run db:sync-schema。
 * 如果模型里出现 provider 专属 @db 类型，这里直接失败，要求人工明确处理。
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const sourcePath = path.join(root, "prisma", "schema.prisma");
const targetPath = path.join(root, "prisma", "schema.mysql.prisma");

const source = fs.readFileSync(sourcePath, "utf8");

if (!/datasource\s+db\s*\{[\s\S]*?provider\s*=\s*"sqlite"[\s\S]*?\}/.test(source)) {
  throw new Error("prisma/schema.prisma 中未找到 datasource db provider = \"sqlite\"");
}

if (/@db\./.test(source)) {
  throw new Error("模型中出现 provider 专属 @db 类型，不能用单源生成 MySQL schema，请改为双 schema 人工维护");
}

const generated = source.replace(
  /(datasource\s+db\s*\{[\s\S]*?provider\s*=\s*)"sqlite"/,
  '$1"mysql"'
);

const header = [
  "// ============================================================",
  "// 本文件由 scripts/db/sync-schema.cjs 生成，禁止手改。",
  "// 唯一手写源：prisma/schema.prisma",
  "// 生成命令：npm run db:sync-schema",
  "// ============================================================",
  ""
].join("\n");

const output = header + generated;
fs.writeFileSync(targetPath, output, "utf8");
console.log(`[db:sync-schema] ${path.relative(root, targetPath)} 已生成`);
