/**
 * ============================================================
 * 全局类型索引（types/index.ts）
 * ------------------------------------------------------------
 * 汇总常用业务类型定义
 * ============================================================
 */

/** 分页查询参数 */
export interface PageParams {
  page?: number;
  pageSize?: number;
}

/** 分页返回结构 */
export interface PageResult<T = any> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 统一 API 响应结构
 * controller 方法统一 return 该结构，由路由层 res.json() 输出
 */
export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  /** 文案插值参数，前端 i18n 用 msg + params 渲染，不返回自然语言 */
  params?: Record<string, string | number | boolean>;
  data: T;
  timestamp: number;
  /** 请求链路 ID，便于前后端按同一条日志排查 */
  requestId?: string;
}
