/**
 * ============================================================
 * 角色控制器（modules/role/role.controller.ts）
 * ------------------------------------------------------------
 * TSOA 版本：类 + 装饰器，路由前缀 /api/v1/role
 * 权限设计：全部需要 RBAC 权限码（superAdmin:role:*）
 * ============================================================
 */

import { Route, Tags, Get, Post, Put, Delete, Body, Path, Security } from "tsoa";
import roleService from "./role.service";
import { BaseController } from "../../base/BaseController";
import { CreateRoleBody, UpdateRoleBody, RoleDto } from "./role.model";
import { createRoleSchema, updateRoleSchema } from "./role.schema";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ApiResponse } from "../../types";

@Route("api/v1/role")
@Tags("Role - 角色权限")
export class RoleController extends BaseController {
  /**
   * 角色列表（含绑定菜单与权限码）
   */
  @Get("list")
  @Security("bearerAuth", ["superAdmin:role:list"])
  public async getList(): Promise<ApiResponse<RoleDto[]>> {
    const result = await roleService.getList();
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 角色详情（含绑定菜单与权限码）
   */
  @Get("{id}")
  @Security("bearerAuth", ["superAdmin:role:list"])
  public async getById(@Path() id: number): Promise<ApiResponse<RoleDto>> {
    const result = await roleService.getById(id);
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 新增角色（可同时绑定菜单）
   */
  @Post()
  @Security("bearerAuth", ["superAdmin:role:create"])
  public async create(@Body() body: CreateRoleBody): Promise<ApiResponse<RoleDto>> {
    const { error } = createRoleSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    const result = await roleService.create(body);
    return this.ok(result, MESSAGE_CODE.CREATE_SUCCESS);
  }

  /**
   * 更新角色（menuIds 传入则整体重建菜单绑定）
   */
  @Put("{id}")
  @Security("bearerAuth", ["superAdmin:role:update"])
  public async update(@Path() id: number, @Body() body: UpdateRoleBody): Promise<ApiResponse> {
    const { error } = updateRoleSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    await roleService.update(id, body);
    return this.ok(null, MESSAGE_CODE.UPDATE_SUCCESS);
  }

  /**
   * 删除角色（被用户引用时拒绝；内置角色 admin/operator/viewer 禁止删除）
   */
  @Delete("{id}")
  @Security("bearerAuth", ["superAdmin:role:delete"])
  public async delete(@Path() id: number): Promise<ApiResponse> {
    await roleService.delete(id);
    return this.ok(null, MESSAGE_CODE.DELETE_SUCCESS);
  }

  /**
   * 单独重建角色-菜单绑定（角色分配界面用，权限点 superAdmin:role:assign）
   */
  @Put("{id}/menus")
  @Security("bearerAuth", ["superAdmin:role:assign"])
  public async assignMenus(@Path() id: number, @Body() body: { menuIds: number[] }): Promise<ApiResponse> {
    if (!Array.isArray(body.menuIds) || body.menuIds.some((x) => !Number.isInteger(x) || x < 1)) {
      return this.failJoi({ details: [{ path: ["menuIds"] }] });
    }

    await roleService.assignMenus(id, body.menuIds);
    return this.ok(null, MESSAGE_CODE.UPDATE_SUCCESS);
  }

  /**
   * 按权限码整体重建角色权限（角色分配界面用，权限点 superAdmin:role:assign）
   */
  @Put("{id}/permissions")
  @Security("bearerAuth", ["superAdmin:role:assign"])
  public async assignPermissions(@Path() id: number, @Body() body: { permissionCodes: string[] }): Promise<ApiResponse> {
    if (!Array.isArray(body.permissionCodes) || body.permissionCodes.some((x) => typeof x !== "string" || !x.trim())) {
      return this.failJoi({ details: [{ path: ["permissionCodes"] }] });
    }

    await roleService.assignPermissions(id, body.permissionCodes);
    return this.ok(null, MESSAGE_CODE.UPDATE_SUCCESS);
  }
}
