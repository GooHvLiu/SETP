/**
 * ============================================================
 * 帮助中心数据类型（modules/help/help.model.ts）
 * ------------------------------------------------------------
 * 静态 / AI 双模式共用同一套类型与数据源（help_doc 表）。
 * 结构对齐前端既有 HelpTree 契约：
 *   版块(HelpSection) → 章节(HelpChapter) → 文章(HelpArticle)
 * ============================================================
 */

/** 帮助文章（静态渲染单元；树接口不含 content，文章接口返回） */
export interface HelpArticle {
  /** 逻辑路径，如 "10-快速上手/01-系统介绍"（不含 locale/source 前缀与扩展名） */
  path: string;
  title: string;
  summary: string;
  content?: string;
  sort: number;
}

/** 帮助章节（二级目录，可空） */
export interface HelpChapter {
  title: string;
  sort: number;
  articles: HelpArticle[];
}

/** 帮助版块（一级目录） */
export interface HelpSection {
  title: string;
  sort: number;
  /** 来源：template 模板文档 / custom 自定义文档 */
  source: "template" | "custom";
  chapters?: HelpChapter[];
  articles?: HelpArticle[];
}

/** AI 对话引用来源 */
export interface HelpArticleSource {
  title: string;
  path: string;
  summary: string;
}

/** AI 对话请求体 */
export interface HelpChatBody {
  question: string;
  locale?: string;
  /** 多轮上下文（可选） */
  history?: { role: "user" | "assistant"; content: string }[];
}

/** AI 对话响应（与前端 HelpChatResponse 契约一致） */
export interface HelpChatResponse {
  /** AI 生成的正文；未命中/降级时为空串，由前端按 answerKey 渲染 */
  answer: string;
  /** 未命中或降级的 i18n key；正常 AI 回答时为空 */
  answerKey?: string;
  /** answerKey 插值参数 */
  params?: Record<string, string | number>;
  sources: HelpArticleSource[];
}

/** 帮助模式（system_configs.help_mode，由 seed 初始化为 static） */
export interface HelpModeDto {
  mode: "static" | "ai";
}

/** AI 服务健康状态（GET /api/v1/help/ai-health，供前端展示 Ollama 可用性） */
export interface HelpAiHealthDto {
  /** Ollama 服务连通性 */
  available: boolean;
  /** 当前配置的对话模型 */
  model: string;
  /** 配置的模型是否已安装（查询 Ollama /api/tags） */
  modelExists: boolean;
  /** Ollama 服务地址 */
  baseUrl: string;
  /** 连通探测耗时（ms） */
  latencyMs: number;
  /** 探测失败原因（成功时为空串） */
  error: string;
}

/** 重建索引结果 */
export interface HelpReindexResult {
  /** 本次索引写入的文档数 */
  count: number;
  /** 扫描到的语言目录数 */
  localeCount: number;
  /** 缺少 manifest 而跳过的语言目录数 */
  skipped: number;
}

/** 管理端知识库文档项（知识库中心页列表） */
export interface HelpDocItem {
  id: number;
  locale: string;
  path: string;
  title: string;
  summary: string;
  /** 来源：template 模板文档 / custom 自定义文档 */
  source: string;
  sectionTitle: string;
  chapterTitle: string;
  updatedAt: string;
}

/** 管理端知识库文档列表结果 */
export interface HelpDocListResult {
  list: HelpDocItem[];
  total: number;
  page: number;
  pageSize: number;
}
