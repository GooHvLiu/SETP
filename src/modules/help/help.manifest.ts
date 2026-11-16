/**
 * ============================================================
 * 帮助中心 manifest 读写层（modules/help/help.manifest.ts）
 * ------------------------------------------------------------
 * manifest 是每个语言目录下的「文件名枚举清单 + 结构声明」：
 *   1. 只声明允许出现哪些文档位（key / title / sort / file）
 *   2. 不描述真实文件夹树，内部层级与文件名由设计者自行决定
 *   3. 每个 locale 一份：data/help/{locale}/help.manifest.json
 *
 * 本文件同时承担：
 *   - manifest JSON 的严格校验与原子写入
 *   - 语言目录发现（目录名即 locale）
 *   - 文件相对路径安全校验与绝对路径解析
 *   - 文件枚举（供 file-options / orphan 检测）
 * ============================================================
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { env } from "@src/config/env.schema";
import { normalizeLocale } from "./helpLocale";

/** manifest 文件名（每个 locale 目录固定一份） */
export const MANIFEST_FILE = "help.manifest.json";

/** locale 目录名格式：zh-cn / en-us / ja-jp / zh-hant 等 */
const LOCALE_RE = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/;

/** manifest 节点 key 格式：仅语言内唯一 */
const KEY_RE = /^[a-z0-9][a-z0-9._-]{0,79}$/;

/** 文档内容类型 */
export type HelpContentType = "md" | "pdf";

/** manifest 中的文档位 */
export interface ManifestDocNode {
  type: "doc";
  key: string;
  title: string;
  summary?: string;
  sort: number;
  /** 相对 locale 目录的 posix 路径，例如 template/10-快速上手/01-系统介绍.md */
  file: string;
  /** 用户帮助页文章路径；省略时由 file 去扩展名生成 */
  path?: string;
  contentType: HelpContentType;
}

/** manifest 中的章节节点 */
export interface ManifestChapterNode {
  type: "chapter";
  key: string;
  title: string;
  sort: number;
  children: ManifestDocNode[];
}

/** manifest 中的版块节点 */
export interface ManifestSectionNode {
  type: "section";
  key: string;
  title: string;
  sort: number;
  source?: "template" | "custom";
  children: Array<ManifestChapterNode | ManifestDocNode>;
}

/** 单个语言的 manifest 结构 */
export interface HelpManifest {
  schemaVersion: 1;
  locale: string;
  title?: string;
  tree: ManifestSectionNode[];
}

/** 文档位 + 它所在的版块/章节（遍历结果） */
export interface ManifestDocContext {
  doc: ManifestDocNode;
  section: ManifestSectionNode;
  chapter?: ManifestChapterNode;
}

/** 语言目录信息 */
export interface LocaleDirInfo {
  locale: string;
  /** 磁盘上的原始目录名（用于拼路径） */
  dirName: string;
  dir: string;
}

/** 扫描到的物理文件 */
export interface LocaleFileInfo {
  /** 相对 locale 目录的 posix 路径 */
  file: string;
  contentType: HelpContentType;
  size: number;
  mtimeMs: number;
  title: string;
}

/** 帮助数据根目录（默认 ./data/help） */
export function helpDataDir(): string {
  return path.resolve(process.cwd(), env.HELP_DATA_DIR || "./data/help");
}

/** 规范化并校验 locale；非法直接抛 HELP_LOCALE_NOT_FOUND */
export function assertLocale(value?: string | null): string {
  const locale = normalizeLocale(value);
  if (!locale || !LOCALE_RE.test(locale)) {
    throw new Error("HELP_LOCALE_NOT_FOUND");
  }
  return locale;
}

/** 语言目录绝对路径 */
export function localeDir(locale: string): string {
  return path.join(helpDataDir(), assertLocale(locale));
}

/** manifest 绝对路径 */
export function manifestPath(locale: string): string {
  return path.join(localeDir(locale), MANIFEST_FILE);
}

/**
 * 发现 data/help 下的语言目录。
 * 只认目录名符合 locale 格式的目录；assets / .history / .trash 等自动跳过。
 */
export function listLocaleDirs(): LocaleDirInfo[] {
  const root = helpDataDir();
  if (!fs.existsSync(root)) return [];

  const result: LocaleDirInfo[] = [];
  const seen = new Set<string>();
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const locale = normalizeLocale(entry.name);
    if (!locale || !LOCALE_RE.test(locale)) continue;
    if (seen.has(locale)) {
      console.warn(`[help] locale 目录重复：${entry.name}，已跳过`);
      continue;
    }
    seen.add(locale);
    result.push({
      locale,
      dirName: entry.name,
      dir: path.join(root, entry.name),
    });
  }
  return result.sort((a, b) => a.locale.localeCompare(b.locale));
}

/** 读取 manifest；目录或文件不存在返回 null */
export function readManifest(locale: string): HelpManifest | null {
  const file = manifestPath(locale);
  if (!fs.existsSync(file)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new Error("HELP_MANIFEST_INVALID");
  }
  return validateManifest(raw, assertLocale(locale));
}

/** 读取 manifest；不存在时抛 HELP_LOCALE_NOT_FOUND */
export function readManifestOrThrow(locale: string): HelpManifest {
  const manifest = readManifest(locale);
  if (!manifest) throw new Error("HELP_LOCALE_NOT_FOUND");
  return manifest;
}

/** 写入 manifest（先校验，再临时文件 + rename 原子替换） */
export function writeManifest(manifest: HelpManifest): HelpManifest {
  const normalized = validateManifest(manifest, assertLocale(manifest.locale));
  const dir = localeDir(normalized.locale);
  fs.mkdirSync(dir, { recursive: true });

  const file = path.join(dir, MANIFEST_FILE);
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
  return normalized;
}

/**
 * 初始化语言目录与空 manifest。
 * 已存在的 manifest 不会被覆盖，只返回 created=false。
 */
export function initLocale(locale: string, title?: string): { created: boolean; manifest: HelpManifest } {
  const loc = assertLocale(locale);
  const dir = localeDir(loc);
  const file = manifestPath(loc);
  fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(file)) {
    return { created: false, manifest: readManifestOrThrow(loc) };
  }

  const manifest: HelpManifest = {
    schemaVersion: 1,
    locale: loc,
    title: (title || "").trim() || loc,
    tree: [],
  };
  writeManifest(manifest);
  return { created: true, manifest };
}

/**
 * 校验并规范化 manifest。
 * 任何结构、key、路径、扩展名问题统一抛 HELP_MANIFEST_INVALID。
 */
export function validateManifest(raw: unknown, expectedLocale: string): HelpManifest {
  if (!isPlainObject(raw)) throw new Error("HELP_MANIFEST_INVALID");
  if (raw.schemaVersion !== 1) throw new Error("HELP_MANIFEST_INVALID");

  const locale = normalizeLocale(String(raw.locale ?? ""));
  if (!locale || locale !== expectedLocale) throw new Error("HELP_MANIFEST_INVALID");

  const title = optionalText(raw.title);
  if (!Array.isArray(raw.tree)) throw new Error("HELP_MANIFEST_INVALID");

  const keys = new Set<string>();
  const tree = raw.tree.map((node) => validateSection(node, keys));

  return {
    schemaVersion: 1,
    locale,
    ...(title ? { title } : {}),
    tree,
  };
}

/** 遍历 manifest：按顺序返回全部文档位 */
export function flattenManifest(manifest: HelpManifest): ManifestDocContext[] {
  const result: ManifestDocContext[] = [];
  for (const section of manifest.tree) {
    for (const child of section.children) {
      if (child.type === "chapter") {
        for (const doc of child.children) {
          result.push({ doc, section, chapter: child });
        }
      } else {
        result.push({ doc: child, section });
      }
    }
  }
  return result;
}

/** 在 manifest 中按 docKey 查找文档位 */
export function findManifestDoc(manifest: HelpManifest, docKey: string): ManifestDocContext | null {
  for (const section of manifest.tree) {
    for (const child of section.children) {
      if (child.type === "chapter") {
        const doc = child.children.find((item) => item.key === docKey);
        if (doc) return { doc, section, chapter: child };
      } else if (child.key === docKey) {
        return { doc: child, section };
      }
    }
  }
  return null;
}

/** 用户帮助页逻辑路径：manifest path 优先，否则 file 去扩展名 */
export function resolveDocPath(doc: ManifestDocNode): string {
  if (doc.path) return normalizeRelPath(doc.path);
  return doc.file.replace(/\.(md|pdf)$/i, "");
}

/** 文档物理绝对路径（相对 locale 目录） */
export function resolveDocFile(locale: string, file: string): string {
  const base = localeDir(locale);
  const rel = normalizeRelPath(file);
  return path.resolve(base, ...rel.split("/"));
}

/** 扫描某个 locale 目录下的全部 md / pdf 文件 */
export function scanLocaleFiles(locale: string): LocaleFileInfo[] {
  const base = localeDir(locale);
  if (!fs.existsSync(base)) return [];

  const result: LocaleFileInfo[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // 历史/回收/临时/静态资源目录不属于知识库文档
        if ([".history", ".trash", ".tmp", "assets"].includes(entry.name)) continue;
        walk(full);
        continue;
      }
      const lower = entry.name.toLowerCase();
      const contentType: HelpContentType | null = lower.endsWith(".md") ? "md" : lower.endsWith(".pdf") ? "pdf" : null;
      if (!contentType) continue;

      const rel = path.relative(base, full).split(path.sep).join("/");
      const stat = fs.statSync(full);
      let title = filePrefixTitle(entry.name.replace(/\.(md|pdf)$/i, ""));
      if (contentType === "md") {
        const meta = parseFrontmatter(fs.readFileSync(full, "utf8"));
        title = meta.title || title;
      }
      result.push({
        file: rel,
        contentType,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        title,
      });
    }
  };
  walk(base);
  return result.sort((a, b) => a.file.localeCompare(b.file));
}

/** 解析 markdown frontmatter：---\ntitle: ...\nsummary: ...\n--- */
export function parseFrontmatter(text: string): { title?: string; summary?: string; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { body: text };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { title: meta.title, summary: meta.summary, body: text.slice(m[0].length) };
}

/** 文件名 "NN-标题" 前缀解析 */
export function parsePrefix(name: string): { sort: number; title: string } {
  const m = name.match(/^(\d+)-(.*)$/);
  if (m) return { sort: Number(m[1]), title: m[2] };
  return { sort: 0, title: name };
}

/** 文件名标题（去 NN- 前缀） */
export function filePrefixTitle(fileBase: string): string {
  return parsePrefix(fileBase).title;
}

/** 计算文件 sha256（用于乐观并发与索引新鲜度判断） */
export function hashFile(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** 规范化相对路径：统一为 posix，拒绝绝对路径、盘符、.. 与空段 */
export function normalizeRelPath(value: string): string {
  let rel = String(value || "")
    .trim()
    .replace(/\\/g, "/");
  if (!rel || rel.startsWith("/") || /^[A-Za-z]:/.test(rel) || rel.includes("\0")) {
    throw new Error("HELP_PATH_INVALID");
  }
  const segs = rel.split("/");
  if (segs.some((seg) => seg === "" || seg === "." || seg === "..")) {
    throw new Error("HELP_PATH_INVALID");
  }
  return segs.join("/");
}

/** 根据扩展名判断内容类型；非法扩展名抛 HELP_PATH_INVALID */
export function contentTypeOfFile(file: string): HelpContentType {
  const lower = file.toLowerCase();
  if (lower.endsWith(".md")) return "md";
  if (lower.endsWith(".pdf")) return "pdf";
  throw new Error("HELP_PATH_INVALID");
}

/** 文本字段：去空白、限长；空串返回 undefined */
function optionalText(value: unknown, max = 300): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  return text.slice(0, max);
}

/** 必填标题：空标题非法 */
function requiredText(value: unknown, max = 120): string {
  const text = optionalText(value, max);
  if (!text) throw new Error("HELP_MANIFEST_INVALID");
  return text;
}

/** 排序号：整数 0-9999 */
function sortValue(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isInteger(n) || n < 0 || n > 9999) throw new Error("HELP_MANIFEST_INVALID");
  return n;
}

/** key：语言内唯一 */
function keyValue(value: unknown, keys: Set<string>): string {
  const key = String(value || "").trim();
  if (!KEY_RE.test(key) || keys.has(key)) throw new Error("HELP_MANIFEST_INVALID");
  keys.add(key);
  return key;
}

/** 校验 section */
function validateSection(raw: unknown, keys: Set<string>): ManifestSectionNode {
  if (!isPlainObject(raw) || raw.type !== "section") throw new Error("HELP_MANIFEST_INVALID");
  const key = keyValue(raw.key, keys);
  const title = requiredText(raw.title);
  const sort = sortValue(raw.sort);
  const source = raw.source === "template" || raw.source === "custom" ? raw.source : undefined;
  if (!Array.isArray(raw.children)) throw new Error("HELP_MANIFEST_INVALID");

  const childTypes = new Set(raw.children.map((child) => (isPlainObject(child) ? String(child.type) : "")));
  if (childTypes.size > 1) throw new Error("HELP_MANIFEST_INVALID");

  const children = raw.children.map((child) => {
    if (!isPlainObject(child) || child.type !== "chapter") {
      return validateDoc(child, keys);
    }
    return validateChapter(child, keys);
  });

  return {
    type: "section",
    key,
    title,
    sort,
    ...(source ? { source } : {}),
    children,
  };
}

/** 校验 chapter */
function validateChapter(raw: unknown, keys: Set<string>): ManifestChapterNode {
  if (!isPlainObject(raw) || raw.type !== "chapter") throw new Error("HELP_MANIFEST_INVALID");
  const key = keyValue(raw.key, keys);
  const title = requiredText(raw.title);
  const sort = sortValue(raw.sort);
  if (!Array.isArray(raw.children)) throw new Error("HELP_MANIFEST_INVALID");

  const children = raw.children.map((child) => validateDoc(child, keys));
  return { type: "chapter", key, title, sort, children };
}

/** 校验 doc */
function validateDoc(raw: unknown, keys: Set<string>): ManifestDocNode {
  if (!isPlainObject(raw) || raw.type !== "doc") throw new Error("HELP_MANIFEST_INVALID");
  const key = keyValue(raw.key, keys);
  const title = requiredText(raw.title);
  const summary = optionalText(raw.summary, 300);
  const sort = sortValue(raw.sort);
  const file = normalizeRelPath(String(raw.file || ""));
  const contentType = contentTypeOfFile(file);
  if (raw.contentType !== contentType) throw new Error("HELP_MANIFEST_INVALID");
  const docPath = raw.path === undefined || raw.path === null || raw.path === "" ? undefined : normalizeRelPath(String(raw.path));

  return {
    type: "doc",
    key,
    title,
    ...(summary ? { summary } : {}),
    sort,
    file,
    ...(docPath ? { path: docPath } : {}),
    contentType,
  };
}

/** 纯对象判断 */
function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
