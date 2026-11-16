/**
 * ============================================================
 * 帮助索引脚本（modules/help/helpIndex.ts）— Prisma 版
 * ------------------------------------------------------------
 * 数据源改为「每语言 manifest + 磁盘文件」：
 *   data/help/{locale}/help.manifest.json   ← 枚举允许的文档位
 *   data/help/{locale}/.../{file}            ← 正文（文件名/层级完全自由）
 *
 * 幂等策略：先收集全部有效文档，再在同一事务内清空 + 整片写入。
 * 空源直接返回，不误清已有索引；并发重建返回 HELP_INDEX_BUSY。
 * ============================================================
 */

import fs from "fs";
import helpDb from "@src/db/helpDb";
import { runHelpMigrations } from "@src/db/helpMigrations";
import { flattenManifest, hashFile, listLocaleDirs, parseFrontmatter, readManifest, resolveDocFile, resolveDocPath } from "./help.manifest";

/**
 * PDF 文本提取依赖（pdf-parse 纯 JS，无原生编译依赖）
 * 惰性加载：仅在处理 PDF 文档时引入，避免依赖缺失时阻塞服务启动
 */
function loadPdfParser(): (buf: Buffer) => Promise<{ text?: string }> {
  try {
    return require("pdf-parse");
  } catch {
    throw new Error("PDF 解析依赖 pdf-parse 未安装，请先执行 npm install");
  }
}

/** PDF 入库长度：summary 前 300 字 / content 前 20000 字（供检索与问答） */
const PDF_SUMMARY_LEN = 300;
const PDF_CONTENT_LEN = 20000;

/** 待入库文档 */
interface IndexDoc {
  locale: string;
  docKey: string;
  path: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  sectionKey: string;
  sectionTitle: string;
  sectionSort: number;
  chapterKey: string;
  chapterTitle: string;
  chapterSort: number;
  articleSort: number;
  contentHash: string;
  fileSize: number;
  fileMtime: number;
  indexedAt: string;
}

/** 提取 PDF 正文文本（pdf-parse，空白归一） */
async function extractPdfText(file: string): Promise<string> {
  const buf = fs.readFileSync(file);
  const data = await loadPdfParser()(buf);
  return (data?.text || "").replace(/[ \t]+/g, " ").trim();
}

/** 从所有语言 manifest 收集可索引文档（空位/缺失文件跳过） */
async function collectIndexDocs(): Promise<{ docs: IndexDoc[]; localeCount: number; skipped: number }> {
  const dirs = listLocaleDirs();
  const docs: IndexDoc[] = [];
  let skipped = 0;
  const indexedAt = new Date().toISOString();

  for (const item of dirs) {
    const manifest = readManifest(item.locale);
    if (!manifest) {
      skipped += 1;
      continue;
    }

    for (const ctx of flattenManifest(manifest)) {
      const abs = resolveDocFile(item.locale, ctx.doc.file);
      if (!fs.existsSync(abs)) continue;

      const stat = fs.statSync(abs);
      const hash = hashFile(abs);
      const docPath = resolveDocPath(ctx.doc);
      const source = ctx.section.source || "custom";
      let title = ctx.doc.title;
      let summary = ctx.doc.summary || "";
      let content = "";

      if (ctx.doc.contentType === "md") {
        const fm = parseFrontmatter(fs.readFileSync(abs, "utf8"));
        title = title || fm.title || ctx.doc.file;
        if (!summary && fm.summary) summary = fm.summary;
        content = fm.body;
      } else {
        const text = await extractPdfText(abs);
        if (!summary) summary = text.slice(0, PDF_SUMMARY_LEN);
        content = text.slice(0, PDF_CONTENT_LEN);
      }

      docs.push({
        locale: item.locale,
        docKey: ctx.doc.key,
        path: docPath,
        title,
        summary,
        content,
        source,
        sectionKey: ctx.section.key,
        sectionTitle: ctx.section.title,
        sectionSort: ctx.section.sort,
        chapterKey: ctx.chapter?.key || "",
        chapterTitle: ctx.chapter?.title || "",
        chapterSort: ctx.chapter?.sort || 0,
        articleSort: ctx.doc.sort,
        contentHash: hash,
        fileSize: stat.size,
        fileMtime: Math.floor(stat.mtimeMs),
        indexedAt,
      });
    }
  }

  return { docs, localeCount: dirs.length, skipped };
}

/** 全量重建索引：manifest 为准，事务内清空 + 写入 */
let indexing = false;

export async function runHelpIndex(): Promise<{ count: number; localeCount: number; skipped: number }> {
  if (indexing) throw new Error("HELP_INDEX_BUSY");
  indexing = true;
  try {
    const collected = await collectIndexDocs();
    if (collected.docs.length === 0) {
      return { count: 0, localeCount: collected.localeCount, skipped: collected.skipped };
    }

    helpDb.transaction(() => {
      helpDb.clear();
      for (const doc of collected.docs) {
        helpDb.execute(
          `INSERT INTO help_doc
             (locale, doc_key, path, title, summary, content, source,
              section_key, section_title, section_sort,
              chapter_key, chapter_title, chapter_sort, article_sort,
              content_hash, file_size, file_mtime, indexed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            doc.locale,
            doc.docKey,
            doc.path,
            doc.title,
            doc.summary,
            doc.content,
            doc.source,
            doc.sectionKey,
            doc.sectionTitle,
            doc.sectionSort,
            doc.chapterKey,
            doc.chapterTitle,
            doc.chapterSort,
            doc.articleSort,
            doc.contentHash,
            doc.fileSize,
            doc.fileMtime,
            doc.indexedAt,
          ]
        );
      }
    });

    return { count: collected.docs.length, localeCount: collected.localeCount, skipped: collected.skipped };
  } finally {
    indexing = false;
  }
}

// 命令行入口：npm run help:index（require.main 守卫保证被 service import 时不重复执行）
if (require.main === module) {
  runHelpMigrations();
  runHelpIndex()
    .then((r) => {
      console.log(`✅ Help 索引完成：${r.count} 篇文档（${r.localeCount} 个语言，跳过 ${r.skipped} 个无 manifest 目录）`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Help 索引失败：", err?.message || err);
      process.exit(1);
    });
}
