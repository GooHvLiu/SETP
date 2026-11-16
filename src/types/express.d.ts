/**
 * ============================================================
 * Express 类型扩展（types/express.d.ts）
 * ------------------------------------------------------------
 * 声明 req.user / res.success / res.error 等自定义属性
 * ============================================================
 */

import "express";

declare global {
  namespace Express {
    interface Request {
      /** 请求链路 ID（pino-http 生成，用于响应体 requestId） */
      id?: string;
      /** 登录用户信息（由 auth 中间件挂载） */
      user?: {
        userId: number;
        username: string;
        type?: "access" | "refresh";
        [key: string]: any;
      };
    }

    interface Response {
      /** 成功响应 */
      success: (data?: any, msg?: string, params?: Record<string, string | number | boolean>) => void;
      /** 失败响应 */
      error: (error: string | number, code?: number, params?: Record<string, string | number | boolean>) => void;
    }
  }
}

export {};
