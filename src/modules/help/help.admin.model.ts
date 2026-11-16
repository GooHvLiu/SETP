/**
 * ============================================================
 * 帮助中心管理端数据契约（modules/help/help.admin.model.ts）
 * ------------------------------------------------------------
 * 只描述「超级面板 / 知识管理中心」需要的返回结构与请求体，
 * 不包含任何页面、组件或交互设计。
 *
 * 状态口径：
 *   published   manifest 有、文件有、索引 hash 与文件一致
 *   empty       manifest 有、文件不存在（空位，等待上传）
 *   stale       manifest 有、文件有、索引 hash 不一致或未索引
 *   orphan      文件有、manifest 无（单独列表，不进入树）
 * ============================================================
 */

import type { HelpContentType } from "./help.manifest";

/** 文档状态（树内） */
export type AdminDocStatus = "published" | "empty" | "stale";

/** 语言索引状态 */
export type AdminIndexState = "clean" | "stale" | "missing";

/** 语言列表项 */
export interface AdminLocaleItem {
  locale: string;
  /** manifest 里的展示名；缺失时回退 locale */
  title: string;
  /** 磁盘目录名（通常等于 locale） */
  dirName: string;
  manifestExists: boolean;
  manifestValid: boolean;
  manifestError: string | null;
  docCount: number;
  publishedCount: number;
  emptyCount: number;
  staleCount: number;
  orphanCount: number;
  indexedCount: number;
  indexState: AdminIndexState;
  lastIndexedAt: string | null;
}

/** 管理树中的文档节点 */
export interface AdminDocNode {
  type: "doc";
  key: string;
  title: string;
  summary: string;
  sort: number;
  /** 相对 locale 目录的 posix 路径 */
  file: string;
  /** 用户帮助页文章路径（后端生成或 manifest 指定） */
  path: string;
  contentType: HelpContentType;
  status: AdminDocStatus;
  /** 文件 sha256；文件不存在时为 null */
  hash: string | null;
  /** 文件字节数；文件不存在时为 0 */
  size: number;
  /** 文件最后修改时间 ISO；文件不存在时为 null */
  fileUpdatedAt: string | null;
  /** 最近一次索引时间 ISO；未索引时为 null */
  indexedAt: string | null;
}

/** 管理树中的章节节点 */
export interface AdminChapterNode {
  type: "chapter";
  key: string;
  title: string;
  sort: number;
  children: AdminDocNode[];
}

/** 管理树中的版块节点 */
export interface AdminSectionNode {
  type: "section";
  key: string;
  title: string;
  sort: number;
  source: "template" | "custom";
  children: Array<AdminChapterNode | AdminDocNode>;
}

/** 文件有、manifest 无 */
export interface AdminOrphanFile {
  file: string;
  contentType: HelpContentType;
  size: number;
  mtime: string;
  title: string;
}

/** 索引状态 */
export interface AdminIndexStatus {
  locale: string;
  indexedCount: number;
  docCount: number;
  publishedCount: number;
  emptyCount: number;
  staleCount: number;
  orphanCount: number;
  state: AdminIndexState;
  lastIndexedAt: string | null;
}

/** GET /admin/slots */
export interface AdminSlotListResult {
  locale: string;
  title: string;
  manifestExists: boolean;
  manifestPath: string;
  tree: AdminSectionNode[];
  orphans: AdminOrphanFile[];
  summary: {
    sectionCount: number;
    chapterCount: number;
    docCount: number;
    publishedCount: number;
    emptyCount: number;
    staleCount: number;
    orphanCount: number;
  };
  index: AdminIndexStatus;
}

/** GET /admin/slots/:docKey */
export interface AdminDocDetail extends AdminDocNode {
  section: { key: string; title: string };
  chapter: { key: string; title: string } | null;
}

/** GET /admin/slots/:docKey/content */
export interface AdminDocContentResult {
  docKey: string;
  contentType: HelpContentType;
  /** md 为原始正文（不含 frontmatter）；pdf 为抽取文本 */
  content: string;
  hash: string;
  size: number;
  /** 乐观并发基线；写回时原样传回 */
  baseHash: string;
}

/** PUT /admin/slots/:docKey/content */
export interface AdminDocSaveResult {
  docKey: string;
  status: "published";
  path: string;
  hash: string;
  size: number;
  indexedAt: string;
}

/** DELETE /admin/slots/:docKey 与 /content */
export interface AdminDocDeleteResult {
  docKey: string;
  status: "empty" | "deleted";
  /** 被移动到回收站的文件相对路径；没有文件时为 null */
  trashedFile: string | null;
}

/** POST /admin/locales/:locale/init */
export interface AdminLocaleInitResult {
  locale: string;
  created: boolean;
  manifestPath: string;
  manifest: {
    schemaVersion: 1;
    locale: string;
    title?: string;
    tree: unknown[];
  };
}

/** POST /admin/assets */
export interface AdminAssetResult {
  /** 可直接放进 markdown 的站内地址 */
  url: string;
  /** 相对 data/help 的路径，例如 assets/xxx.png */
  path: string;
  size: number;
  mimeType: string;
}

/** GET /admin/slots/file-options */
export interface AdminFileOption {
  file: string;
  contentType: HelpContentType;
  size: number;
  mtime: string;
  title: string;
  /** 是否已被 manifest 中某个文档位占用 */
  used: boolean;
  /** 占用它的 docKey；未占用为 null */
  docKey: string | null;
}

export interface AdminFileOptionsResult {
  locale: string;
  list: AdminFileOption[];
  total: number;
  page: number;
  pageSize: number;
}

/** GET /admin/index/status */
export interface AdminIndexStatusResult {
  locales: AdminIndexStatus[];
  summary: {
    localeCount: number;
    docCount: number;
    indexedCount: number;
    staleCount: number;
    orphanCount: number;
    emptyCount: number;
  };
}

/** PATCH /admin/locales/:locale */
export interface UpdateLocaleBody {
  /** 新目录名 / 新 locale；不传或与当前相同则只改展示名 */
  newLocale?: string;
  /** 展示名；传空字符串则移除，回退显示 locale */
  title?: string;
}

/** PATCH /admin/locales/:locale */
export interface AdminLocaleUpdateResult {
  previousLocale: string;
  /** 是否发生了目录改名 */
  renamed: boolean;
  locale: AdminLocaleItem;
}

/** DELETE /admin/locales/:locale */
export interface AdminLocaleDeleteResult {
  locale: string;
  status: "deleted";
  /** manifest 中登记的文档数（manifest 损坏时为 0） */
  docCount: number;
  /** 删除的索引行数 */
  removedIndexRows: number;
}

/** POST /admin/slots */
export interface CreateSlotBody {
  locale?: string;
  /** 版块 key；不存在时配合 sectionTitle 新建 */
  sectionKey: string;
  sectionTitle?: string;
  sectionSort?: number;
  sectionSource?: "template" | "custom";
  /** 章节 key；版块已有章节时必填；不存在时配合 chapterTitle 新建 */
  chapterKey?: string;
  chapterTitle?: string;
  chapterSort?: number;
  /** 新文档位 key，语言内唯一 */
  key: string;
  title: string;
  summary?: string;
  sort?: number;
  /** 相对 locale 目录的文件路径，必须 .md / .pdf */
  file: string;
  contentType: HelpContentType;
  /** 可选；省略时由 file 去扩展名生成 */
  path?: string;
}

/** PUT /admin/slots/:docKey */
export interface UpdateSlotBody {
  locale?: string;
  title?: string;
  summary?: string;
  sort?: number;
  path?: string;
}

/** 删除类接口的二次确认：confirm 必须等于 docKey */
export interface HelpConfirmBody {
  confirm?: string;
  locale?: string;
}
