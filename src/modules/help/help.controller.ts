/**
 * ============================================================
 * 帮助中心控制器（modules/help/help.controller.ts）— TSOA 版
 * ------------------------------------------------------------
 * 登录即可访问（@Security("bearerAuth") 不带权限码），
 * 静态/AI 共用 help_doc 数据源；模式由 system_configs.help_mode 控制。
 * ============================================================
 */

import { Body, Get, Post, Query, Route, Security, Tags } from "tsoa";
import helpService from "./help.service";
import { BaseController } from "../../base/BaseController";
import { chatBodySchema, treeQuerySchema, articleQuerySchema } from "./help.schema";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ApiResponse } from "../../types";
import {
  HelpArticle,
  HelpSection,
  HelpChatBody,
  HelpChatResponse,
  HelpModeDto,
  HelpReindexResult,
  HelpAiHealthDto,
  HelpDocListResult,
} from "./help.model";

@Tags("Help - 帮助中心")
@Route("api/v1/help")
export class HelpController extends BaseController {
  /** 文档树（版块→章节→文章，基于前端当前语言传 locale） */
  @Get("tree")
  @Security("bearerAuth")
  public async getTree(@Query() locale?: string): Promise<ApiResponse<HelpSection[]>> {
    const { error } = treeQuerySchema.validate({ locale });
    if (error) {
      return this.failJoi(error);
    }
    const result = await helpService.getTree(locale);
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /** 文章内容（md 内 assets/ 图片路径已重写为 /api/v1/help/assets/） */
  @Get("article")
  @Security("bearerAuth")
  public async getArticle(@Query() locale?: string, @Query() path?: string): Promise<ApiResponse<HelpArticle>> {
    const { error } = articleQuerySchema.validate({ locale, path });
    if (error) {
      return this.failJoi(error);
    }
    const result = await helpService.getArticle(locale, path);
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /** AI 对话（Ollama 生成；不可达/超时自动降级为检索摘要） */
  @Post("chat")
  @Security("bearerAuth")
  public async chat(@Body() body: HelpChatBody): Promise<ApiResponse<HelpChatResponse>> {
    const { error } = chatBodySchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }
    const result = await helpService.chat(body);
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /** 当前帮助模式（static|ai，来自 system_configs.help_mode） */
  @Get("mode")
  @Security("bearerAuth")
  public async getMode(): Promise<ApiResponse<HelpModeDto>> {
    const result = await helpService.getMode();
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /** AI 服务健康状态（Ollama 连通性 + 配置模型是否已安装，供前端展示 AI 可用性） */
  @Get("ai-health")
  @Security("bearerAuth")
  public async getAiHealth(): Promise<ApiResponse<HelpAiHealthDto>> {
    const result = await helpService.getAiHealth();
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /** 重建索引（需超级管理员权限；等价 npm run help:index，幂等全量重建） */
  @Post("admin/reindex")
  @Security("bearerAuth", ["superAdmin:help:reindex"])
  public async reindex(): Promise<ApiResponse<HelpReindexResult>> {
    const result = await helpService.reindex();
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /** 管理端知识库文档列表（知识库中心页使用，页面权限码 knowledgeCenter:list） */
  @Get("admin/docs")
  @Security("bearerAuth", ["superAdmin:knowledgeCenter:list"])
  public async listDocs(
    @Query() page: number = 1,
    @Query() pageSize: number = 10,
    @Query() keyword?: string
  ): Promise<ApiResponse<HelpDocListResult>> {
    const result = await helpService.listDocs({ page, pageSize, keyword });
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }
}
