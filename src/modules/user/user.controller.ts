/**
 * ============================================================
 * 用户模块控制器（modules/user/user.controller.ts）
 * ------------------------------------------------------------
 * TSOA 版本：类 + 装饰器，路由前缀 /api/v1/user
 * 全部需要 admin 角色（RBAC 权限码）
 * ============================================================
 */

import { Route, Tags, Get, Post, Put, Delete, Body, Path, Query, Request, Security } from "tsoa";
import { Request as ExpressRequest } from "express";
import userService from "./user.service";
import { BaseController } from "../../base/BaseController";
import { CreateUserBody, UpdateUserBody, BatchDeleteBody, BatchDeleteResult, UserDto, UserListResult } from "./user.model";
import { createUserSchema, updateUserSchema, listUserSchema, batchDeleteSchema } from "./user.schema";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ApiResponse } from "../../types";

@Route("api/v1/user")
@Tags("User - 用户中心")
export class UserController extends BaseController {
  /**
   * 获取用户列表（分页）
   */
  @Get("list")
  @Security("bearerAuth", ["adminCenter:user:list"])
  public async getList(
    @Request() request: ExpressRequest,
    @Query() page: number = 1,
    @Query() pageSize: number = 10,
    @Query() username?: string,
    @Query() realName?: string,
    @Query() status?: number
  ): Promise<ApiResponse<UserListResult>> {
    const { error } = listUserSchema.validate({ page, pageSize, username, realName, status });
    if (error) {
      return this.failJoi(error);
    }

    const result = await userService.getList({ page, pageSize, username, realName, status }, (request as any).user?.isSuper === 1);
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 获取用户详情
   */
  @Get("{id}")
  @Security("bearerAuth", ["adminCenter:user:list"])
  public async getById(@Path() id: number, @Request() request: ExpressRequest): Promise<ApiResponse<UserDto>> {
    const data = await userService.getById(id, (request as any).user?.isSuper === 1);
    return this.ok(data, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 新增用户
   */
  @Post()
  @Security("bearerAuth", ["adminCenter:user:create"])
  public async create(@Body() body: CreateUserBody, @Request() request: ExpressRequest): Promise<ApiResponse<UserDto>> {
    const { error } = createUserSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    const result = await userService.create(body, (request as any).user?.userId);
    return this.ok(result, MESSAGE_CODE.CREATE_SUCCESS);
  }

  /**
   * 更新用户
   */
  @Put("{id}")
  @Security("bearerAuth", ["adminCenter:user:update"])
  public async update(@Path() id: number, @Body() body: UpdateUserBody, @Request() request: ExpressRequest): Promise<ApiResponse> {
    const { error } = updateUserSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    await userService.update(id, body, (request as any).user?.userId);
    return this.ok(null, MESSAGE_CODE.UPDATE_SUCCESS);
  }

  /**
   * 管理员重置用户密码（使用模板默认重置口令，重置后首次登录强制改密）
   */
  @Post("{id}/reset-password")
  @Security("bearerAuth", ["adminCenter:user:update"])
  public async resetPassword(@Path() id: number, @Request() request: ExpressRequest): Promise<ApiResponse> {
    await userService.resetPassword(id, (request as any).user?.userId);
    return this.ok(null, MESSAGE_CODE.UPDATE_SUCCESS);
  }

  /**
   * 审核通过自助注册账号（status=2 → 1，首次登录仍强制改密）
   */
  @Post("{id}/approve")
  @Security("bearerAuth", ["adminCenter:user:update"])
  public async approve(@Path() id: number, @Request() request: ExpressRequest): Promise<ApiResponse<UserDto>> {
    const result = await userService.approve(id, (request as any).user?.userId);
    return this.ok(result, MESSAGE_CODE.UPDATE_SUCCESS);
  }

  /**
   * 驳回复助注册账号（status=2 → 0 禁用）
   */
  @Post("{id}/reject")
  @Security("bearerAuth", ["adminCenter:user:update"])
  public async reject(@Path() id: number, @Request() request: ExpressRequest): Promise<ApiResponse<UserDto>> {
    const result = await userService.reject(id, (request as any).user?.userId);
    return this.ok(result, MESSAGE_CODE.UPDATE_SUCCESS);
  }

  /**
   * 删除用户（软删除）
   */
  @Delete("{id}")
  @Security("bearerAuth", ["adminCenter:user:delete"])
  public async delete(@Path() id: number, @Request() request: ExpressRequest): Promise<ApiResponse> {
    await userService.delete(id, (request as any).user?.userId);
    return this.ok(null, MESSAGE_CODE.DELETE_SUCCESS);
  }

  /**
   * 批量删除用户（软删除）
   */
  @Post("batch-delete")
  @Security("bearerAuth", ["adminCenter:user:delete"])
  public async deleteBatch(@Body() body: BatchDeleteBody, @Request() request: ExpressRequest): Promise<ApiResponse<BatchDeleteResult>> {
    const { error } = batchDeleteSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    const result = await userService.deleteBatch(body.ids, (request as any).user?.userId);
    return this.ok(result, MESSAGE_CODE.DELETE_SUCCESS);
  }
}
