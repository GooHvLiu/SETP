/**
 * ============================================================
 * 菜单控制器（modules/menu/menu.controller.ts）
 * ------------------------------------------------------------
 * TSOA 版本：类 + 装饰器，路由前缀 /api/v1/menu
 * 权限设计：
 *   - GET /tree        仅登录即可（前端动态路由的数据源）
 *   - GET /list        需 superAdmin:menu:list（管理端配置）
 *   - POST / PUT / DELETE  需对应维护权限码
 * ============================================================
 */

import { Route, Tags, Get, Post, Put, Delete, Body, Path, Request, Security } from "tsoa";
import { Request as ExpressRequest } from "express";
import menuService from "./menu.service";
import { BaseController } from "../../base/BaseController";
import { CreateMenuBody, UpdateMenuBody, MenuDto, DeletedMenuDto } from "./menu.model";
import { MenuTreeNode } from "../../utils/menuTree";
import { createMenuSchema, updateMenuSchema } from "./menu.schema";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ERROR_CODE } from "../../constants/errorCode";
import { ApiResponse } from "../../types";

@Route("api/v1/menu")
@Tags("Menu - 菜单权限")
export class MenuController extends BaseController {
  /**
   * 当前用户可见菜单树（登录后前端拉取，生成动态路由）
   * 只返回 DIR/MENU 且 visible=1 的节点；按钮权限由 permissions 控制
   */
  @Get("tree")
  @Security("bearerAuth")
  public async getTree(@Request() request: ExpressRequest): Promise<ApiResponse<MenuTreeNode[]>> {
    const userId = request.user?.userId;
    if (!userId) {
      return this.fail(ERROR_CODE.UNAUTHORIZED);
    }

    const result = await menuService.getTreeByUser(userId);
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 管理端全量菜单树（含按钮，菜单配置界面用）
   */
  @Get("list")
  @Security("bearerAuth", ["superAdmin:menu:list"])
  public async getList(): Promise<ApiResponse<MenuTreeNode[]>> {
    const result = await menuService.getList();
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 已删除菜单清单（回收站，扁平结构，需 superAdmin:menu:list）
   */
  @Get("deleted")
  @Security("bearerAuth", ["superAdmin:menu:list"])
  public async getDeleted(): Promise<ApiResponse<DeletedMenuDto[]>> {
    const result = await menuService.getDeletedList();
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 恢复已删除菜单（需 superAdmin:menu:restore；不恢复角色绑定）
   */
  @Post("{id}/restore")
  @Security("bearerAuth", ["superAdmin:menu:restore"])
  public async restore(@Path() id: number): Promise<ApiResponse<MenuDto>> {
    const result = await menuService.restore(id);
    return this.ok(result, MESSAGE_CODE.RESTORE_SUCCESS);
  }

  /**
   * 新增菜单/权限点
   */
  @Post()
  @Security("bearerAuth", ["superAdmin:menu:create"])
  public async create(@Body() body: CreateMenuBody): Promise<ApiResponse<MenuDto>> {
    const { error } = createMenuSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    const result = await menuService.create(body);
    return this.ok(result as unknown as MenuDto, MESSAGE_CODE.CREATE_SUCCESS);
  }

  /**
   * 更新菜单/权限点
   */
  @Put("{id}")
  @Security("bearerAuth", ["superAdmin:menu:update"])
  public async update(@Path() id: number, @Body() body: UpdateMenuBody): Promise<ApiResponse> {
    const { error } = updateMenuSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    await menuService.update(id, body);
    return this.ok(null, MESSAGE_CODE.UPDATE_SUCCESS);
  }

  /**
   * 删除菜单（有子菜单拒绝；同步清理角色关联）
   */
  @Delete("{id}")
  @Security("bearerAuth", ["superAdmin:menu:delete"])
  public async delete(@Path() id: number): Promise<ApiResponse> {
    await menuService.delete(id);
    return this.ok(null, MESSAGE_CODE.DELETE_SUCCESS);
  }
}
