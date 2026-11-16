/**
 * ============================================================
 * 帮助中心业务逻辑（modules/help/help.service.ts）— Prisma 版
 * ------------------------------------------------------------
 * 职责：
 *   1. 文档树 / 文章内容（数据源 help_doc 表，静态模式用）
 *   2. AI 对话（检索 + Ollama 生成，失败自动降级为检索摘要）
 *   3. 模式读取（system_configs.help_mode，seed 初始化为 static，未配置报 30005）
 *   4. 重建索引（等价 npm run help:index，登录即可触发）
 *
 * 检索策略（跨库通用，不依赖 FTS5）：
 *   - 查询词构造：整句 + 分隔拆词 + 中文双字滑窗（≤20 词）
 *   - SQLite / MySQL 均用 LIKE（Prisma contains 生成），
 *     % _ 按字面量处理，两库行为一致
 *   - 结果按 JS 评分排序：命中词 title×3 / summary×2 / content×1 累加，取 top3
 * ============================================================
 */

import { getConfigNumber, getConfigValue } from "@src/config/runtimeConfig";
import helpDb from "@src/db/helpDb";
import { DEFAULT_HELP_LOCALE, localeDisplayName, normalizeLocale } from "./helpLocale";
import { runHelpIndex } from "./helpIndex";
import {
  HelpArticle,
  HelpChapter,
  HelpSection,
  HelpArticleSource,
  HelpChatResponse,
  HelpModeDto,
  HelpReindexResult,
  HelpAiHealthDto,
  HelpDocItem,
  HelpDocListResult,
} from "./help.model";

/** 默认语言：system_configs.default_locale，未配置或为空时回退 zh-cn */
function getDefaultLocale(): string {
  return normalizeLocale(getConfigValue("default_locale")) || DEFAULT_HELP_LOCALE;
}

/** 前端未传 locale 时读默认语言；传了则统一为小写连字符 */
function resolveLocale(locale?: string): string {
  return normalizeLocale(locale) || getDefaultLocale();
}

/** 图片静态资源 URL 前缀（app.ts 将 data/help/assets 托管在该路径） */
const ASSET_PREFIX = "/api/v1/help/assets/";

/** LIKE 通配符转义（% _ \ 按字面量处理，与跨库检索行为一致） */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}

/**
 * 重写正文内图片相对路径：
 *   ![图](assets/xxx.png) → ![图](/api/v1/help/assets/xxx.png)
 * 只处理 assets/ 开头的相对路径，外链与绝对路径不动
 */
function rewriteAssetLinks(content: string): string {
  return content.replace(/!\[([^\]]*)\]\(assets\/([^)\s]+)\)/g, `![$1](${ASSET_PREFIX}$2)`);
}

/** 树组装行（数据库行 → 树节点所需字段） */
interface TreeRow {
  path: string;
  title: string;
  summary: string;
  source: string;
  sectionKey: string;
  sectionTitle: string;
  sectionSort: number;
  chapterKey: string;
  chapterTitle: string;
  chapterSort: number;
  articleSort: number;
}

/**
 * 把按 (sectionSort, chapterSort, articleSort) 排序的行组装成 版块→章节→文章 三层树。
 * 版块/章节用 manifest key 做唯一标识，避免同名版块被错误合并。
 */
function buildTree(rows: TreeRow[]): HelpSection[] {
  const sectionMap = new Map<string, { section: HelpSection; chapters: Map<string, HelpChapter> }>();
  const order: string[] = [];

  for (const r of rows) {
    const sectionKey = r.sectionKey || r.sectionTitle;
    if (!sectionMap.has(sectionKey)) {
      sectionMap.set(sectionKey, {
        section: {
          title: r.sectionTitle,
          sort: r.sectionSort,
          source: r.source as "template" | "custom",
          chapters: [],
          articles: [],
        },
        chapters: new Map<string, HelpChapter>(),
      });
      order.push(sectionKey);
    }

    const acc = sectionMap.get(sectionKey)!;
    const article: HelpArticle = { path: r.path, title: r.title, summary: r.summary, sort: r.articleSort };
    if (r.chapterTitle) {
      const chapterKey = r.chapterKey || r.chapterTitle;
      let chapter = acc.chapters.get(chapterKey);
      if (!chapter) {
        chapter = { title: r.chapterTitle, sort: r.chapterSort, articles: [] };
        acc.chapters.set(chapterKey, chapter);
        acc.section.chapters!.push(chapter);
      }
      chapter.articles.push(article);
    } else {
      acc.section.articles!.push(article);
    }
  }

  const result: HelpSection[] = [];
  for (const key of order) {
    const { section } = sectionMap.get(key)!;
    // 结构最小化：有章节则只留 chapters，无章节则只留 articles
    if (section.chapters!.length > 0) {
      delete section.articles;
      section.chapters!.sort((a, b) => a.sort - b.sort);
    } else {
      delete section.chapters;
    }
    result.push(section);
  }
  return result;
}

/** 检索命中（content 只用于拼 AI 上下文，不对外返回） */
interface SearchHit extends HelpArticleSource {
  content: string;
}

class HelpService {
  /** 文档树：按 locale 聚合 */
  async getTree(locale?: string): Promise<HelpSection[]> {
    const loc = resolveLocale(locale);
    const rows = helpDb.query<TreeRow>(
      `SELECT path, title, summary, source,
              section_key, section_title, section_sort,
              chapter_key, chapter_title, chapter_sort, article_sort
       FROM help_doc
       WHERE locale = ?
       ORDER BY section_sort ASC, chapter_sort ASC, article_sort ASC, id ASC`,
      [loc]
    );
    return buildTree(rows);
  }

  /** 文章内容：正文副本 + 图片相对路径重写 */
  async getArticle(locale?: string, path?: string): Promise<HelpArticle> {
    const loc = resolveLocale(locale);
    if (!path) {
      throw new Error("HELP_ARTICLE_NOT_FOUND");
    }
    const doc = helpDb.queryOne<any>("SELECT * FROM help_doc WHERE locale = ? AND path = ? LIMIT 1", [loc, path]);
    if (!doc) {
      throw new Error("HELP_ARTICLE_NOT_FOUND");
    }
    return {
      path: doc.path,
      title: doc.title,
      summary: doc.summary,
      content: rewriteAssetLinks(doc.content),
      sort: doc.articleSort,
    };
  }

  /** 查询词构造：整句 + 分隔拆词 + 中文双字滑窗（跨库 LIKE 行为一致，无 FTS） */
  private buildTerms(q: string): string[] {
    const terms = new Set<string>();
    const t = q.trim();
    if (t.length >= 2) terms.add(t);
    for (const seg of t.split(/[\s,，。！？!?、;；:：()（）"'']+/)) {
      if (seg.length >= 2) terms.add(seg);
    }
    if (/[\u4e00-\u9fa5]/.test(t)) {
      for (let i = 0; i + 2 <= t.length; i++) terms.add(t.slice(i, i + 2));
    }
    return [...terms].slice(0, getConfigNumber("help_search_term_limit"));
  }

  /** 检索命中文档（AI 对话上下文）：跨库 LIKE + JS 评分，top3 */
  private async search(locale: string, keyword: string): Promise<SearchHit[]> {
    const terms = this.buildTerms(keyword);
    if (terms.length === 0) return [];
    const like = (t: string) => `%${escapeLike(t)}%`;
    const conds = terms.map((t) => `(title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')`).join(" OR ");
    const params = terms.flatMap((t) => [like(t), like(t), like(t)]);
    const rows = helpDb.query<any>(
      `SELECT path, title, summary, content FROM help_doc
       WHERE locale = ? AND (${conds})`,
      [locale, ...params]
    );
    return rows
      .map((r) => {
        // JS 评分：每个命中词 title×3、summary×2、content×1 累加
        let score = 0;
        for (const t of terms) {
          if (r.title.includes(t)) score += 3;
          if (r.summary.includes(t)) score += 2;
          if (r.content.includes(t)) score += 1;
        }
        return { score, item: { title: r.title, path: r.path, summary: r.summary, content: r.content } };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, getConfigNumber("help_search_top_n"))
      .map((x) => x.item);
  }

  /** AI 对话：检索 → Ollama 生成；不可达/超时自动降级为检索摘要拼接 */
  async chat(body: { question: string; locale?: string; history?: { role: string; content: string }[] }): Promise<HelpChatResponse> {
    const loc = resolveLocale(body.locale);
    const hits = await this.search(loc, body.question);
    const sources: HelpArticleSource[] = hits.map(({ title, path, summary }) => ({ title, path, summary }));
    // 诊断日志（摘要级）：请求 / 检索命中 / Ollama 结果与降级原因，便于排查 AI 回答卡住或降级
    console.log(`[help] chat 请求 question="${body.question.slice(0, 60)}" locale=${loc}`);
    console.log(`[help] 检索命中 sources=${sources.length}`);
    // 未命中策略：system_configs.help_answer_policy（strict 直接不答 / lenient 模型兜底），默认 strict
    if (sources.length === 0) {
      const policy = await this.getAnswerPolicy();
      if (policy === "strict") {
        console.log(`[help] chat 未命中直接不答 policy=${policy}`);
        return { answer: "", answerKey: "help.chat.noResult", sources: [] };
      }
    }

    // 拼接检索上下文：标题 + 摘要 + 正文（截断，避免超长 prompt）
    const context = hits.map((s, i) => `[${i + 1}] ${s.title}\n摘要：${s.summary}\n正文：${s.content.slice(0, 3000)}`).join("\n\n");

    // 多轮上下文透传（如有）
    const prompt =
      body.history && body.history.length > 0
        ? `${body.history.map((h) => `${h.role === "user" ? "用户" : "助手"}：${h.content}`).join("\n")}\n\n用户：${body.question}`
        : body.question;

    const startedAt = Date.now();
    try {
      const answer = await this.callOllama(loc, context, prompt);
      console.log(`[help] chat 返回 AI回答 耗时=${Date.now() - startedAt}ms 长度=${answer.length} 摘要=${answer.slice(0, 100)}`);
      return { answer, sources };
    } catch (err) {
      // 降级策略：Ollama 不可达/超时 → 返回检索命中文档摘要，功能不中断
      console.warn(
        `[help] chat 降级 原因=${(err as Error)?.message || String(err)} 耗时=${Date.now() - startedAt}ms sources=${sources.length}`
      );
      const fallback =
        sources.length > 0
          ? { answer: "", answerKey: "help.chat.aiUnavailableWithSources", sources }
          : { answer: "", answerKey: "help.chat.noResult", sources };
      return fallback;
    }
  }

  /** 调用 Ollama /api/chat（Node 18+ 原生 fetch，带超时） */
  private async callOllama(locale: string, context: string, prompt: string): Promise<string> {
    const baseUrl = getConfigValue("ai_service_url").trim().replace(/\/+$/, "");
    const model = getConfigValue("ai_model_name").trim();
    if (!baseUrl || !model) {
      throw new Error("AI_NOT_CONFIGURED");
    }
    const timeoutMs = getConfigNumber("ai_timeout");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            {
              role: "system",
              content: `你是项目帮助中心问答助手。仅可依据下方参考资料回答；资料中不存在的内容，一律明确回答"未收录"或建议查看相关文档，严禁编造或使用自身知识补充。回答语言：${localeDisplayName(locale)}。\n\n参考资料：\n${context || "（无）"}`,
            },
            { role: "user", content: prompt },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`OLLAMA_HTTP_${res.status}`);
      }
      const data = await res.json();
      return (data?.message?.content as string) ?? "";
    } finally {
      clearTimeout(timer);
    }
  }

  /** AI 服务健康探测：Ollama 连通性 + 配置模型是否已安装（供前端展示 AI 可用状态） */
  async getAiHealth(): Promise<HelpAiHealthDto> {
    const baseUrl = getConfigValue("ai_service_url").trim().replace(/\/+$/, "");
    const model = getConfigValue("ai_model_name").trim();
    if (!baseUrl || !model) {
      return { available: false, model, modelExists: false, baseUrl, latencyMs: 0, error: "AI_NOT_CONFIGURED" };
    }
    const timeoutMs = getConfigNumber("health_ai_probe_timeout_ms");
    const startedAt = Date.now();
    let available = false;
    let modelExists = false;
    let error = "";
    try {
      const probe = async (path: string): Promise<Response> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          return await fetch(`${baseUrl}${path}`, { signal: controller.signal });
        } finally {
          clearTimeout(timer);
        }
      };
      const res = await probe("/api/version");
      if (!res.ok) {
        throw new Error(`OLLAMA_HTTP_${res.status}`);
      }
      available = true;
      const tagsRes = await probe("/api/tags");
      if (tagsRes.ok) {
        const tags = (await tagsRes.json()) as { models?: { name?: string }[] };
        modelExists = Array.isArray(tags?.models) && tags.models.some((m) => m?.name === model);
      }
    } catch (err) {
      error = (err as Error)?.message || String(err);
    }
    return { available, model, modelExists, baseUrl, latencyMs: Date.now() - startedAt, error };
  }

  /** 未命中策略：system_configs.help_answer_policy（strict 直接不答 / lenient 模型兜底），默认 strict */
  private async getAnswerPolicy(): Promise<"strict" | "lenient"> {
    return getConfigValue("help_answer_policy") === "lenient" ? "lenient" : "strict";
  }

  /** 当前帮助模式：system_configs.help_mode（seed 初始化 static，未配置/非法值报 30005） */
  async getMode(): Promise<HelpModeDto> {
    const mode = getConfigValue("help_mode");
    if (mode !== "static" && mode !== "ai") {
      throw new Error("HELP_MODE_NOT_CONFIGURED");
    }
    return { mode };
  }

  /** 重建索引（等价 npm run help:index，幂等全量重建） */
  async reindex(): Promise<HelpReindexResult> {
    return runHelpIndex();
  }

  /**
   * 管理端知识库文档列表（知识库中心页使用）
   * 直接读 help_doc 索引表，不扫描磁盘文件
   */
  async listDocs(params: { page?: number; pageSize?: number; keyword?: string }): Promise<HelpDocListResult> {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(Math.max(1, Number(params.pageSize) || 10), 100);
    const offset = (page - 1) * pageSize;
    const keyword = (params.keyword || "").trim();

    const whereSql = keyword ? "WHERE title LIKE ? OR path LIKE ?" : "";
    const whereParams = keyword ? [`%${keyword}%`, `%${keyword}%`] : [];

    const totalRow = helpDb.queryOne<{ total: number }>(`SELECT COUNT(*) AS total FROM help_doc ${whereSql}`, whereParams);
    const total = Number(totalRow?.total ?? 0);

    const rows = helpDb.query<HelpDocItem>(
      `SELECT id, locale, path, title, summary, source, section_title, chapter_title, updated_at
       FROM help_doc ${whereSql}
       ORDER BY section_sort ASC, chapter_sort ASC, article_sort ASC, id ASC
       LIMIT ? OFFSET ?`,
      [...whereParams, pageSize, offset]
    );

    return { list: rows, total, page, pageSize };
  }
}

export default new HelpService();
