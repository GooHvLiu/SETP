/**
 * ============================================================
 * 帮助中心管理端业务（modules/help/help.admin.service.ts）
 * ------------------------------------------------------------
 * 超级面板 / 知识管理中心的数据来源：
 *   - manifest：结构、标题、排序、文件枚举
 *   - 磁盘文件：正文真相
 *   - help_doc：检索索引（由 runHelpIndex 重建）
 *
 * 写操作顺序：校验 → 备份 → 原子替换文件 → 单篇 upsert 索引 → 更新 manifest
 * ============================================================
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getConfigValue } from "@src/config/runtimeConfig";
import { HELP_ASSETS_DIR, HELP_MAX_CONTENT_SIZE, HELP_MAX_IMAGE_SIZE, HELP_MAX_MARKDOWN_SIZE } from "@src/config/help.config";
import helpDb from "@src/db/helpDb";
import { DEFAULT_HELP_LOCALE, normalizeLocale } from "./helpLocale";
import {
  MANIFEST_FILE,
  HelpManifest,
  ManifestDocNode,
  ManifestSectionNode,
  assertLocale,
  contentTypeOfFile,
  filePrefixTitle,
  findManifestDoc,
  flattenManifest,
  hashFile,
  helpDataDir,
  initLocale,
  listLocaleDirs,
  localeDir,
  manifestPath,
  normalizeRelPath,
  parseFrontmatter,
  readManifest,
  readManifestOrThrow,
  resolveDocFile,
  resolveDocPath,
  scanLocaleFiles,
  writeManifest,
} from "./help.manifest";
import {
  AdminDocContentResult,
  AdminDocDeleteResult,
  AdminDocDetail,
  AdminDocNode,
  AdminDocSaveResult,
  AdminFileOption,
  AdminFileOptionsResult,
  AdminIndexState,
  AdminIndexStatus,
  AdminIndexStatusResult,
  AdminLocaleDeleteResult,
  AdminLocaleInitResult,
  AdminLocaleItem,
  AdminLocaleUpdateResult,
  AdminOrphanFile,
  AdminSectionNode,
  AdminSlotListResult,
  CreateSlotBody,
  UpdateLocaleBody,
  UpdateSlotBody,
} from "./help.admin.model";

/** 默认语言：system_configs.default_locale，未配置回退 zh-cn */
function defaultLocale(): string {
  return normalizeLocale(getConfigValue("default_locale")) || DEFAULT_HELP_LOCALE;
}

/** 管理端 locale 解析：请求未传时用默认语言 */
function adminLocale(locale?: string): string {
  return assertLocale(locale || defaultLocale());
}

/** 文件存在判断 */
function exists(file: string): boolean {
  return fs.existsSync(file);
}

/** 目录 mtime 转 ISO */
function iso(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return new Date(value).toISOString();
}

/** 索引行 */
interface IndexRow {
  docKey: string;
  path: string;
  contentHash: string;
  fileSize: number;
  fileMtime: number;
  indexedAt: string | null;
}

/** 读取某语言的索引行，按 docKey / path 双索引 */
function readIndexRows(locale: string): {
  byKey: Map<string, IndexRow>;
  byPath: Map<string, IndexRow>;
  indexedCount: number;
  lastIndexedAt: string | null;
} {
  const rows = helpDb.query<IndexRow>(
    `SELECT doc_key, path, content_hash, file_size, file_mtime, indexed_at
     FROM help_doc WHERE locale = ?`,
    [locale]
  );
  const byKey = new Map<string, IndexRow>();
  const byPath = new Map<string, IndexRow>();
  let lastIndexedAt: string | null = null;
  for (const row of rows) {
    if (row.docKey) byKey.set(row.docKey, row);
    if (row.path) byPath.set(row.path, row);
    if (row.indexedAt && (!lastIndexedAt || row.indexedAt > lastIndexedAt)) lastIndexedAt = row.indexedAt;
  }
  return { byKey, byPath, indexedCount: rows.length, lastIndexedAt };
}

/** 单个文档位的状态计算 */
function buildDocNode(locale: string, doc: ManifestDocNode, index: ReturnType<typeof readIndexRows>): AdminDocNode {
  const abs = resolveDocFile(locale, doc.file);
  const db = index.byKey.get(doc.key) || index.byPath.get(resolveDocPath(doc));

  if (!exists(abs)) {
    return {
      type: "doc",
      key: doc.key,
      title: doc.title,
      summary: doc.summary || "",
      sort: doc.sort,
      file: doc.file,
      path: resolveDocPath(doc),
      contentType: doc.contentType,
      status: "empty",
      hash: null,
      size: 0,
      fileUpdatedAt: null,
      indexedAt: db?.indexedAt || null,
    };
  }

  const stat = fs.statSync(abs);
  const hash = hashFile(abs);
  const status = db && db.contentHash === hash ? "published" : "stale";
  return {
    type: "doc",
    key: doc.key,
    title: doc.title,
    summary: doc.summary || "",
    sort: doc.sort,
    file: doc.file,
    path: resolveDocPath(doc),
    contentType: doc.contentType,
    status,
    hash,
    size: stat.size,
    fileUpdatedAt: iso(stat.mtimeMs),
    indexedAt: db?.indexedAt || null,
  };
}

/** 管理树 + orphan + 统计 */
function buildSnapshot(
  locale: string,
  manifest: HelpManifest
): {
  tree: AdminSectionNode[];
  orphans: AdminOrphanFile[];
  summary: AdminSlotListResult["summary"];
  index: AdminIndexStatus;
} {
  const index = readIndexRows(locale);
  let sectionCount = 0;
  let chapterCount = 0;
  let docCount = 0;
  let publishedCount = 0;
  let emptyCount = 0;
  let staleCount = 0;

  const tree: AdminSectionNode[] = manifest.tree.map((section) => {
    sectionCount += 1;
    const children = section.children.map((child) => {
      if (child.type === "chapter") {
        chapterCount += 1;
        return {
          type: "chapter" as const,
          key: child.key,
          title: child.title,
          sort: child.sort,
          children: child.children.map((doc) => {
            docCount += 1;
            const node = buildDocNode(locale, doc, index);
            if (node.status === "published") publishedCount += 1;
            else if (node.status === "empty") emptyCount += 1;
            else staleCount += 1;
            return node;
          }),
        };
      }
      docCount += 1;
      const node = buildDocNode(locale, child, index);
      if (node.status === "published") publishedCount += 1;
      else if (node.status === "empty") emptyCount += 1;
      else staleCount += 1;
      return node;
    });

    return {
      type: "section" as const,
      key: section.key,
      title: section.title,
      sort: section.sort,
      source: section.source || "custom",
      children,
    };
  });

  const referenced = new Set(flattenManifest(manifest).map((item) => item.doc.file));
  const orphans: AdminOrphanFile[] = scanLocaleFiles(locale)
    .filter((file) => !referenced.has(file.file))
    .map((file) => ({
      file: file.file,
      contentType: file.contentType,
      size: file.size,
      mtime: iso(file.mtimeMs) as string,
      title: file.title,
    }));

  let state: AdminIndexState;
  if (docCount === 0) state = "clean";
  else if (index.indexedCount === 0) state = "missing";
  else if (staleCount > 0 || orphans.length > 0 || index.indexedCount !== publishedCount) state = "stale";
  else state = "clean";

  return {
    tree,
    orphans,
    summary: {
      sectionCount,
      chapterCount,
      docCount,
      publishedCount,
      emptyCount,
      staleCount,
      orphanCount: orphans.length,
    },
    index: {
      locale,
      indexedCount: index.indexedCount,
      docCount,
      publishedCount,
      emptyCount,
      staleCount,
      orphanCount: orphans.length,
      state,
      lastIndexedAt: index.lastIndexedAt,
    },
  };
}

/** 语言列表项（manifest 缺失/非法也能返回） */
function buildLocaleItem(locale: string, dirName: string): AdminLocaleItem {
  const manifestExists = fs.existsSync(manifestPath(locale));
  const index = readIndexRows(locale);
  let manifest: HelpManifest | null = null;
  let manifestError: string | null = null;
  try {
    manifest = readManifest(locale);
  } catch (err) {
    manifestError = (err as Error)?.message || String(err);
  }

  if (!manifest) {
    return {
      locale,
      title: locale,
      dirName,
      manifestExists,
      manifestValid: false,
      manifestError,
      docCount: 0,
      publishedCount: 0,
      emptyCount: 0,
      staleCount: 0,
      orphanCount: 0,
      indexedCount: index.indexedCount,
      indexState: index.indexedCount > 0 ? "stale" : "missing",
      lastIndexedAt: index.lastIndexedAt,
    };
  }

  const snapshot = buildSnapshot(locale, manifest);
  return {
    locale,
    title: manifest.title || locale,
    dirName,
    manifestExists: true,
    manifestValid: true,
    manifestError: null,
    docCount: snapshot.summary.docCount,
    publishedCount: snapshot.summary.publishedCount,
    emptyCount: snapshot.summary.emptyCount,
    staleCount: snapshot.summary.staleCount,
    orphanCount: snapshot.summary.orphanCount,
    indexedCount: snapshot.index.indexedCount,
    indexState: snapshot.index.state,
    lastIndexedAt: snapshot.index.lastIndexedAt,
  };
}

/** manifest 内 key 格式校验 */
function assertKey(value: string): string {
  const key = String(value || "").trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(key)) throw new Error("HELP_MANIFEST_INVALID");
  return key;
}

/** 找 section；不存在则按请求创建 */
function ensureSection(manifest: HelpManifest, body: CreateSlotBody): ManifestSectionNode {
  const key = assertKey(body.sectionKey);
  const found = manifest.tree.find((section) => section.key === key);
  if (found) return found;
  if (!body.sectionTitle || !String(body.sectionTitle).trim()) throw new Error("HELP_MANIFEST_INVALID");

  const maxSort = manifest.tree.reduce((max, section) => Math.max(max, section.sort), 0);
  const section: ManifestSectionNode = {
    type: "section",
    key,
    title: String(body.sectionTitle).trim(),
    sort: Number.isInteger(body.sectionSort) ? Number(body.sectionSort) : maxSort + 10,
    source: body.sectionSource === "template" ? "template" : "custom",
    children: [],
  };
  manifest.tree.push(section);
  return section;
}

/** 找 chapter；不存在则按请求创建 */
function ensureChapter(section: ManifestSectionNode, body: CreateSlotBody) {
  if (!body.chapterKey) return null;
  const key = assertKey(body.chapterKey);

  if (section.children.some((child) => child.type === "doc")) {
    throw new Error("HELP_MANIFEST_INVALID");
  }

  const found = section.children.find((child) => child.type === "chapter" && child.key === key);
  if (found && found.type === "chapter") return found;
  if (!body.chapterTitle || !String(body.chapterTitle).trim()) throw new Error("HELP_MANIFEST_INVALID");

  const maxSort = section.children.reduce((max, child) => Math.max(max, child.sort), 0);
  const chapter = {
    type: "chapter" as const,
    key,
    title: String(body.chapterTitle).trim(),
    sort: Number.isInteger(body.chapterSort) ? Number(body.chapterSort) : maxSort + 10,
    children: [] as ManifestDocNode[],
  };
  section.children.push(chapter);
  return chapter;
}

/** 文档位插入容器 */
function docContainer(section: ManifestSectionNode, chapter: ReturnType<typeof ensureChapter>): ManifestDocNode[] {
  if (chapter) return chapter.children;
  if (section.children.some((child) => child.type === "chapter")) {
    throw new Error("HELP_MANIFEST_INVALID");
  }
  return section.children as ManifestDocNode[];
}

/** 回收站相对路径 */
function trashRelative(file: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `.trash/${date}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${path.basename(file)}`;
}

/** 移动文件到 .trash（不存在则返回 null） */
function moveToTrash(locale: string, file: string): string | null {
  const source = resolveDocFile(locale, file);
  if (!exists(source)) return null;
  const rel = trashRelative(file);
  const target = path.join(localeDir(locale), ...rel.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(source, target);
  return rel;
}

/** 抽取 PDF 文本（与 helpIndex 口径一致，惰性加载） */
async function extractPdfText(file: string): Promise<string> {
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(fs.readFileSync(file));
  return String(data.text || "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 删除索引中的单篇（docKey 或 path 命中） */
function deleteIndexRow(locale: string, docKey: string, docPath: string): void {
  helpDb.execute("DELETE FROM help_doc WHERE locale = ? AND (doc_key = ? OR path = ?)", [locale, docKey, docPath]);
}

/** 管理端业务 */
class HelpAdminService {
  /** 语言列表 */
  async listLocales(): Promise<AdminLocaleItem[]> {
    return listLocaleDirs().map((item) => buildLocaleItem(item.locale, item.dirName));
  }

  /** 初始化语言目录 + 空 manifest（已存在不覆盖） */
  async initLocale(locale: string, title?: string): Promise<AdminLocaleInitResult> {
    const loc = adminLocale(locale);
    const result = initLocale(loc, title);
    return {
      locale: loc,
      created: result.created,
      manifestPath: manifestPath(loc),
      manifest: result.manifest,
    };
  }

  /**
   * 修改语言展示名或目录名。
   * 目录改名只改后端 data/help/<locale> 与 manifest.locale，并平移该语言索引；
   * 前端语言包 / 语言码是否同步由人工确认，后端不做一致性约束。
   */
  async updateLocale(locale: string | undefined, body: UpdateLocaleBody): Promise<AdminLocaleUpdateResult> {
    const oldLoc = adminLocale(locale);
    const oldDir = localeDir(oldLoc);
    if (!fs.existsSync(oldDir)) throw new Error("HELP_LOCALE_NOT_FOUND");

    let manifest: HelpManifest;
    try {
      manifest = readManifestOrThrow(oldLoc);
    } catch (err) {
      if ((err as Error).message !== "HELP_LOCALE_NOT_FOUND") throw err;
      manifest = { schemaVersion: 1, locale: oldLoc, title: oldLoc, tree: [] };
    }

    const rawNewLocale = body.newLocale === undefined ? "" : String(body.newLocale).trim();
    const newLoc = rawNewLocale ? assertLocale(rawNewLocale) : oldLoc;
    const titleProvided = body.title !== undefined;
    const nextTitle = titleProvided
      ? String(body.title || "").trim()
      : newLoc !== oldLoc && (!manifest.title || manifest.title === oldLoc)
        ? newLoc
        : manifest.title;

    if (newLoc === oldLoc && !titleProvided) {
      return { previousLocale: oldLoc, renamed: false, locale: buildLocaleItem(oldLoc, oldLoc) };
    }
    if (newLoc !== oldLoc && fs.existsSync(localeDir(newLoc))) throw new Error("HELP_LOCALE_CONFLICT");

    if (newLoc === oldLoc) {
      writeManifest({ ...manifest, ...(nextTitle ? { title: nextTitle } : {}) });
      return { previousLocale: oldLoc, renamed: false, locale: buildLocaleItem(oldLoc, oldLoc) };
    }

    const newDir = localeDir(newLoc);
    fs.renameSync(oldDir, newDir);
    try {
      writeManifest({ ...manifest, locale: newLoc, ...(nextTitle ? { title: nextTitle } : {}) });
      // 目标 locale 可能残留旧索引，先清掉再平移，避免 (locale, doc_key) 唯一索引冲突
      helpDb.execute("DELETE FROM help_doc WHERE locale = ?", [newLoc]);
      helpDb.execute("UPDATE help_doc SET locale = ? WHERE locale = ?", [newLoc, oldLoc]);
    } catch (err) {
      try {
        fs.renameSync(newDir, oldDir);
      } catch {
        // 回滚失败时保留现场，由人工处理
      }
      try {
        writeManifest(manifest);
      } catch {
        // 同上
      }
      throw err;
    }

    return { previousLocale: oldLoc, renamed: true, locale: buildLocaleItem(newLoc, newLoc) };
  }

  /** 直接删除语言目录与索引；不保留备份，需人工自行备份 */
  async deleteLocale(locale: string | undefined, confirm?: string): Promise<AdminLocaleDeleteResult> {
    const loc = adminLocale(locale);
    if (!confirm || (confirm !== loc && confirm !== locale)) throw new Error("HELP_CONFIRM_REQUIRED");

    const dir = localeDir(loc);
    if (!fs.existsSync(dir)) throw new Error("HELP_LOCALE_NOT_FOUND");

    let docCount = 0;
    try {
      const manifest = readManifest(loc);
      if (manifest) docCount = flattenManifest(manifest).length;
    } catch {
      // manifest 损坏也允许删除
    }
    const index = readIndexRows(loc);

    helpDb.execute("DELETE FROM help_doc WHERE locale = ?", [loc]);
    fs.rmSync(dir, { recursive: true, force: true });

    return { locale: loc, status: "deleted", docCount, removedIndexRows: index.indexedCount };
  }

  /** 管理树（manifest 缺失时返回空树，前端按 manifestExists=false 引导初始化） */
  async getSlots(locale?: string): Promise<AdminSlotListResult> {
    const loc = adminLocale(locale);
    let manifest: HelpManifest | null = null;
    try {
      manifest = readManifest(loc);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "HELP_LOCALE_NOT_FOUND") throw error;
    }
    if (!manifest) {
      const index = readIndexRows(loc);
      return {
        locale: loc,
        title: loc,
        manifestExists: false,
        manifestPath: manifestPath(loc),
        tree: [],
        orphans: [],
        summary: { sectionCount: 0, chapterCount: 0, docCount: 0, publishedCount: 0, emptyCount: 0, staleCount: 0, orphanCount: 0 },
        index: {
          locale: loc,
          indexedCount: index.indexedCount,
          docCount: 0,
          publishedCount: 0,
          emptyCount: 0,
          staleCount: 0,
          orphanCount: 0,
          state: index.indexedCount > 0 ? "stale" : "missing",
          lastIndexedAt: index.lastIndexedAt,
        },
      };
    }
    const snapshot = buildSnapshot(loc, manifest);
    return {
      locale: loc,
      title: manifest.title || loc,
      manifestExists: true,
      manifestPath: manifestPath(loc),
      tree: snapshot.tree,
      orphans: snapshot.orphans,
      summary: snapshot.summary,
      index: snapshot.index,
    };
  }

  /** 单个文档位详情 */
  async getSlot(locale: string | undefined, docKey: string): Promise<AdminDocDetail> {
    const loc = adminLocale(locale);
    const manifest = readManifestOrThrow(loc);
    const hit = findManifestDoc(manifest, docKey);
    if (!hit) throw new Error("HELP_SLOT_NOT_FOUND");
    const index = readIndexRows(loc);
    const node = buildDocNode(loc, hit.doc, index);
    return {
      ...node,
      section: { key: hit.section.key, title: hit.section.title },
      chapter: hit.chapter ? { key: hit.chapter.key, title: hit.chapter.title } : null,
    };
  }

  /** 文档正文（md 去 frontmatter；pdf 抽取文本） */
  async getSlotContent(locale: string | undefined, docKey: string): Promise<AdminDocContentResult> {
    const loc = adminLocale(locale);
    const manifest = readManifestOrThrow(loc);
    const hit = findManifestDoc(manifest, docKey);
    if (!hit) throw new Error("HELP_SLOT_NOT_FOUND");

    const abs = resolveDocFile(loc, hit.doc.file);
    if (!exists(abs)) throw new Error("HELP_FILE_NOT_FOUND");

    const hash = hashFile(abs);
    const size = fs.statSync(abs).size;
    let content: string;
    if (hit.doc.contentType === "md") {
      content = parseFrontmatter(fs.readFileSync(abs, "utf8")).body;
    } else {
      content = await extractPdfText(abs);
    }
    return {
      docKey: hit.doc.key,
      contentType: hit.doc.contentType,
      content,
      hash,
      size,
      baseHash: hash,
    };
  }

  /** 文档物理文件（供下载/预览） */
  async getSlotFile(
    locale: string | undefined,
    docKey: string
  ): Promise<{
    absolutePath: string;
    fileName: string;
    contentType: string;
  }> {
    const loc = adminLocale(locale);
    const manifest = readManifestOrThrow(loc);
    const hit = findManifestDoc(manifest, docKey);
    if (!hit) throw new Error("HELP_SLOT_NOT_FOUND");
    const abs = resolveDocFile(loc, hit.doc.file);
    if (!exists(abs)) throw new Error("HELP_FILE_NOT_FOUND");
    return {
      absolutePath: abs,
      fileName: path.basename(abs),
      contentType: hit.doc.contentType === "pdf" ? "application/pdf" : "text/markdown; charset=utf-8",
    };
  }

  /** 新建文档位（只写 manifest，不创建文件） */
  async createSlot(body: CreateSlotBody): Promise<AdminDocDetail> {
    const loc = adminLocale(body.locale);
    const manifest = readManifestOrThrow(loc);

    const section = ensureSection(manifest, body);
    const chapter = ensureChapter(section, body);
    const container = docContainer(section, chapter);

    const key = assertKey(body.key);
    if (flattenManifest(manifest).some((item) => item.doc.key === key)) {
      throw new Error("HELP_DOC_CONFLICT");
    }

    const file = normalizeRelPath(body.file);
    const contentType = contentTypeOfFile(file);
    if (body.contentType !== contentType) throw new Error("HELP_PATH_INVALID");
    if (flattenManifest(manifest).some((item) => item.doc.file === file)) {
      throw new Error("HELP_DOC_CONFLICT");
    }

    const maxSort = container.reduce((max, doc) => Math.max(max, doc.sort), 0);
    const doc: ManifestDocNode = {
      type: "doc",
      key,
      title: String(body.title || "").trim(),
      ...(body.summary ? { summary: String(body.summary).trim().slice(0, 300) } : {}),
      sort: Number.isInteger(body.sort) ? Number(body.sort) : maxSort + 1,
      file,
      ...(body.path ? { path: normalizeRelPath(body.path) } : {}),
      contentType,
    };
    if (!doc.title) throw new Error("HELP_MANIFEST_INVALID");
    container.push(doc);

    writeManifest(manifest);
    return this.getSlot(loc, doc.key);
  }

  /** 更新文档位展示信息（标题/摘要/排序/用户路径） */
  async updateSlot(locale: string | undefined, docKey: string, body: UpdateSlotBody): Promise<AdminDocDetail> {
    const loc = adminLocale(locale);
    const manifest = readManifestOrThrow(loc);
    const hit = findManifestDoc(manifest, docKey);
    if (!hit) throw new Error("HELP_SLOT_NOT_FOUND");

    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) throw new Error("HELP_MANIFEST_INVALID");
      hit.doc.title = title.slice(0, 120);
    }
    if (body.summary !== undefined) {
      const summary = String(body.summary).trim().slice(0, 300);
      if (summary) hit.doc.summary = summary;
      else delete hit.doc.summary;
    }
    if (body.sort !== undefined) {
      const sort = Number(body.sort);
      if (!Number.isInteger(sort) || sort < 0 || sort > 9999) throw new Error("HELP_MANIFEST_INVALID");
      hit.doc.sort = sort;
    }

    const oldPath = resolveDocPath(hit.doc);
    if (body.path !== undefined) {
      const nextPath = String(body.path || "").trim();
      if (nextPath) hit.doc.path = normalizeRelPath(nextPath);
      else delete hit.doc.path;
    }
    const nextPath = resolveDocPath(hit.doc);

    writeManifest(manifest);

    if (oldPath !== nextPath) {
      try {
        helpDb.execute("UPDATE help_doc SET path = ?, updated_at = CURRENT_TIMESTAMP WHERE locale = ? AND doc_key = ?", [
          nextPath,
          loc,
          hit.doc.key,
        ]);
      } catch {
        throw new Error("HELP_DOC_CONFLICT");
      }
    }
    return this.getSlot(loc, docKey);
  }

  /** 删除文档位（manifest + 文件 + 索引） */
  async deleteSlot(locale: string | undefined, docKey: string, confirm?: string): Promise<AdminDocDeleteResult> {
    if (!confirm || confirm !== docKey) throw new Error("HELP_CONFIRM_REQUIRED");
    const loc = adminLocale(locale);
    const manifest = readManifestOrThrow(loc);
    const hit = findManifestDoc(manifest, docKey);
    if (!hit) throw new Error("HELP_SLOT_NOT_FOUND");

    const docPath = resolveDocPath(hit.doc);
    const trashedFile = moveToTrash(loc, hit.doc.file);
    deleteIndexRow(loc, hit.doc.key, docPath);

    if (hit.chapter) {
      hit.chapter.children = hit.chapter.children.filter((doc) => doc.key !== docKey);
    } else {
      hit.section.children = hit.section.children.filter((child) => !(child.type === "doc" && child.key === docKey));
    }
    writeManifest(manifest);

    return { docKey, status: "deleted", trashedFile };
  }

  /** 清空文档位内容（保留 manifest 槽位，状态变 empty） */
  async deleteSlotContent(locale: string | undefined, docKey: string, confirm?: string): Promise<AdminDocDeleteResult> {
    if (!confirm || confirm !== docKey) throw new Error("HELP_CONFIRM_REQUIRED");
    const loc = adminLocale(locale);
    const manifest = readManifestOrThrow(loc);
    const hit = findManifestDoc(manifest, docKey);
    if (!hit) throw new Error("HELP_SLOT_NOT_FOUND");

    const trashedFile = moveToTrash(loc, hit.doc.file);
    deleteIndexRow(loc, hit.doc.key, resolveDocPath(hit.doc));
    return { docKey, status: "empty", trashedFile };
  }

  /**
   * 上传/替换文档内容。
   * 调用方已用 multer 落到临时文件；本方法负责大小/扩展名/基线校验、
   * 历史备份、原子替换、单篇 upsert。
   */
  async saveSlotContent(params: {
    locale?: string;
    docKey: string;
    tempFile: string;
    originalName: string;
    size: number;
    baseHash?: string;
  }): Promise<AdminDocSaveResult> {
    const loc = adminLocale(params.locale);
    const manifest = readManifestOrThrow(loc);
    const hit = findManifestDoc(manifest, params.docKey);
    if (!hit) throw new Error("HELP_SLOT_NOT_FOUND");

    const ext = path.extname(params.originalName || params.tempFile).toLowerCase();
    const contentType = contentTypeOfFile(ext);
    if (contentType !== hit.doc.contentType) throw new Error("HELP_PATH_INVALID");

    const limit = contentType === "md" ? HELP_MAX_MARKDOWN_SIZE : HELP_MAX_CONTENT_SIZE;
    if (params.size > limit) throw new Error("FILE_TOO_LARGE");

    const target = resolveDocFile(loc, hit.doc.file);
    const hadFile = exists(target);
    const currentHash = hadFile ? hashFile(target) : null;
    if (params.baseHash && currentHash && params.baseHash !== currentHash) {
      throw new Error("HELP_DOC_CONFLICT");
    }

    let backup: string | null = null;
    if (hadFile) {
      const historyDir = path.join(localeDir(loc), ".history", new Date().toISOString().slice(0, 10));
      fs.mkdirSync(historyDir, { recursive: true });
      backup = path.join(historyDir, `${Date.now()}-${path.basename(target)}`);
      fs.copyFileSync(target, backup);
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(params.tempFile, target);

    let content: string;
    let summary = hit.doc.summary || "";
    if (contentType === "md") {
      const text = fs.readFileSync(target, "utf8");
      const meta = parseFrontmatter(text);
      content = meta.body;
      if (!summary && meta.summary) summary = meta.summary;
    } else {
      content = await extractPdfText(target);
    }

    const stat = fs.statSync(target);
    const hash = hashFile(target);
    const indexedAt = new Date().toISOString();
    const docPath = resolveDocPath(hit.doc);
    const source = hit.section.source || "custom";

    try {
      helpDb.transaction(() => {
        helpDb.execute("DELETE FROM help_doc WHERE locale = ? AND (doc_key = ? OR path = ?)", [loc, hit.doc.key, docPath]);
        helpDb.execute(
          `INSERT INTO help_doc
           (locale, doc_key, path, title, summary, content, source,
            section_key, section_title, section_sort,
            chapter_key, chapter_title, chapter_sort, article_sort,
            content_hash, file_size, file_mtime, indexed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            loc,
            hit.doc.key,
            docPath,
            hit.doc.title,
            summary,
            content,
            source,
            hit.section.key,
            hit.section.title,
            hit.section.sort,
            hit.chapter?.key || "",
            hit.chapter?.title || "",
            hit.chapter?.sort || 0,
            hit.doc.sort,
            hash,
            stat.size,
            Math.floor(stat.mtimeMs),
            indexedAt,
          ]
        );
      });
    } catch (err) {
      // 索引写失败时回滚文件，避免正文与索引脱节
      if (backup && exists(backup)) fs.copyFileSync(backup, target);
      throw new Error("HELP_INDEX_BUSY");
    }

    return {
      docKey: hit.doc.key,
      status: "published",
      path: docPath,
      hash,
      size: stat.size,
      indexedAt,
    };
  }

  /** 上传图片资源（markdown 中写 assets/xxx.png） */
  async saveAsset(params: { tempFile: string; originalName: string; size: number }): Promise<{
    url: string;
    path: string;
    size: number;
    mimeType: string;
  }> {
    const ext = path.extname(params.originalName || params.tempFile).toLowerCase();
    const mime: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
    };
    if (!mime[ext]) throw new Error("FILE_TYPE_NOT_ALLOWED");
    if (params.size > HELP_MAX_IMAGE_SIZE) throw new Error("FILE_TOO_LARGE");

    const assetDir = HELP_ASSETS_DIR;
    fs.mkdirSync(assetDir, { recursive: true });
    const name = `${crypto.randomUUID()}${ext}`;
    const target = path.join(assetDir, name);
    fs.renameSync(params.tempFile, target);

    return {
      url: `/api/v1/help/assets/${name}`,
      path: `assets/${name}`,
      size: params.size,
      mimeType: mime[ext],
    };
  }

  /** 枚举 locale 目录下可用于文档位的文件 */
  async listFileOptions(params: {
    locale?: string;
    keyword?: string;
    contentType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<AdminFileOptionsResult> {
    const loc = adminLocale(params.locale);
    const manifest = readManifestOrThrow(loc);
    const referenced = new Map<string, string>();
    for (const item of flattenManifest(manifest)) referenced.set(item.doc.file, item.doc.key);

    const keyword = (params.keyword || "").trim().toLowerCase();
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(Math.max(1, Number(params.pageSize) || 20), 100);

    const all: AdminFileOption[] = scanLocaleFiles(loc)
      .filter((file) => !params.contentType || file.contentType === params.contentType)
      .filter((file) => !keyword || file.file.toLowerCase().includes(keyword) || file.title.toLowerCase().includes(keyword))
      .map((file) => ({
        file: file.file,
        contentType: file.contentType,
        size: file.size,
        mtime: iso(file.mtimeMs) as string,
        title: file.title || filePrefixTitle(path.basename(file.file)),
        used: referenced.has(file.file),
        docKey: referenced.get(file.file) || null,
      }));

    const total = all.length;
    const list = all.slice((page - 1) * pageSize, page * pageSize);
    return { locale: loc, list, total, page, pageSize };
  }

  /** 索引状态（单个语言或全部语言） */
  async getIndexStatus(locale?: string): Promise<AdminIndexStatusResult> {
    const targets = locale
      ? [{ locale: adminLocale(locale), dirName: adminLocale(locale) }]
      : listLocaleDirs().map((item) => ({ locale: item.locale, dirName: item.dirName }));

    const locales: AdminIndexStatus[] = [];
    for (const item of targets) {
      let manifest: HelpManifest | null = null;
      try {
        manifest = readManifest(item.locale);
      } catch {
        manifest = null;
      }
      if (!manifest) {
        const index = readIndexRows(item.locale);
        locales.push({
          locale: item.locale,
          indexedCount: index.indexedCount,
          docCount: 0,
          publishedCount: 0,
          emptyCount: 0,
          staleCount: 0,
          orphanCount: 0,
          state: "missing",
          lastIndexedAt: index.lastIndexedAt,
        });
        continue;
      }
      locales.push(buildSnapshot(item.locale, manifest).index);
    }

    const summary = locales.reduce(
      (acc, item) => {
        acc.docCount += item.docCount;
        acc.indexedCount += item.indexedCount;
        acc.staleCount += item.staleCount;
        acc.orphanCount += item.orphanCount;
        acc.emptyCount += item.emptyCount;
        return acc;
      },
      { localeCount: locales.length, docCount: 0, indexedCount: 0, staleCount: 0, orphanCount: 0, emptyCount: 0 }
    );
    return { locales, summary };
  }
}

export default new HelpAdminService();
