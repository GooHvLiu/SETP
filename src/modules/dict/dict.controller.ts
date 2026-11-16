/**
 * ============================================================
 * 数据字典控制器（modules/dict/dict.controller.ts）
 * ------------------------------------------------------------
 * 查询接口公开（前端下拉/标签用），维护接口需权限码
 * ============================================================
 */

import { Route, Tags, Get, Post, Put, Delete, Body, Path, Query, Security } from "tsoa";
import dictService from "./dict.service";
import { BaseController } from "../../base/BaseController";
import { DictItemDto, DictGroupDto, DictTypeRecordDto, DictDataRecordDto, DictTypeListResult, DictDataListResult } from "./dict.model";
import { createTypeSchema, updateTypeSchema, createDataSchema, updateDataSchema, listTypeSchema, listDataSchema } from "./dict.schema";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ApiResponse } from "../../types";

@Route("api/v1/dict")
@Tags("Dict - 数据字典")
export class DictController extends BaseController {
  /**
   * 按类型编码查询字典项（公开接口，前端下拉框用）
   */
  @Get("type/{typeCode}")
  @Security("")
  public async getByType(@Path() typeCode: string): Promise<ApiResponse<DictItemDto[]>> {
    const result = await dictService.getDictByType(typeCode);
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 获取全部字典（公开接口，前端启动时拉取）
   */
  @Get("all")
  @Security("")
  public async getAll(): Promise<ApiResponse<DictGroupDto[]>> {
    const result = await dictService.getAllDict();
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 新增字典类型（admin）
   */
  @Post("type")
  @Security("bearerAuth", ["superAdmin:dict:update"])
  public async createType(@Body() body: { typeCode: string; typeName: string; remark?: string }): Promise<ApiResponse<DictTypeRecordDto>> {
    const { error } = createTypeSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    const result = await dictService.createType(body);
    return this.ok(result, MESSAGE_CODE.CREATE_SUCCESS);
  }

  /**
   * 更新字典类型（admin）
   */
  @Put("type/{id}")
  @Security("bearerAuth", ["superAdmin:dict:update"])
  public async updateType(@Path() id: number, @Body() body: { typeName?: string; remark?: string; status?: number }): Promise<ApiResponse> {
    const { error } = updateTypeSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    await dictService.updateType(id, body);
    return this.ok(null, MESSAGE_CODE.UPDATE_SUCCESS);
  }

  /**
   * 删除字典类型（admin，级联删字典项）
   */
  @Delete("type/{id}")
  @Security("bearerAuth", ["superAdmin:dict:update"])
  public async deleteType(@Path() id: number): Promise<ApiResponse> {
    await dictService.deleteType(id);
    return this.ok(null, MESSAGE_CODE.DELETE_SUCCESS);
  }

  /**
   * 新增字典项（admin）
   */
  @Post("data")
  @Security("bearerAuth", ["superAdmin:dict:update"])
  public async createData(
    @Body() body: { dictTypeId: number; label: string; value: string; sort?: number }
  ): Promise<ApiResponse<DictDataRecordDto>> {
    const { error } = createDataSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    const result = await dictService.createData(body);
    return this.ok(result, MESSAGE_CODE.CREATE_SUCCESS);
  }

  /**
   * 更新字典项（admin）
   */
  @Put("data/{id}")
  @Security("bearerAuth", ["superAdmin:dict:update"])
  public async updateData(
    @Path() id: number,
    @Body() body: { label?: string; value?: string; sort?: number; status?: number }
  ): Promise<ApiResponse> {
    const { error } = updateDataSchema.validate(body);
    if (error) {
      return this.failJoi(error);
    }

    await dictService.updateData(id, body);
    return this.ok(null, MESSAGE_CODE.UPDATE_SUCCESS);
  }

  /**
   * 删除字典项（admin）
   */
  @Delete("data/{id}")
  @Security("bearerAuth", ["superAdmin:dict:update"])
  public async deleteData(@Path() id: number): Promise<ApiResponse> {
    await dictService.deleteData(id);
    return this.ok(null, MESSAGE_CODE.DELETE_SUCCESS);
  }

  /**
   * 管理端字典类型列表（分页 + 关键字 + 状态过滤，含停用项；需 superAdmin:dictCenter:list）
   */
  @Get("admin/types")
  @Security("bearerAuth", ["superAdmin:dictCenter:list"])
  public async getAdminTypes(
    @Query() page: number = 1,
    @Query() pageSize: number = 10,
    @Query() keyword?: string,
    @Query() status?: number
  ): Promise<ApiResponse<DictTypeListResult>> {
    const { error } = listTypeSchema.validate({ page, pageSize, keyword, status });
    if (error) {
      return this.failJoi(error);
    }

    const result = await dictService.getAdminTypes({ page, pageSize, keyword, status });
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }

  /**
   * 管理端字典项列表（分页 + 关键字 + 状态过滤，含停用项；需 superAdmin:dictCenter:list）
   */
  @Get("admin/data")
  @Security("bearerAuth", ["superAdmin:dictCenter:list"])
  public async getAdminData(
    @Query() typeId: number,
    @Query() page: number = 1,
    @Query() pageSize: number = 10,
    @Query() keyword?: string,
    @Query() status?: number
  ): Promise<ApiResponse<DictDataListResult>> {
    const { error } = listDataSchema.validate({ typeId, page, pageSize, keyword, status });
    if (error) {
      return this.failJoi(error);
    }

    const result = await dictService.getAdminData({ typeId, page, pageSize, keyword, status });
    return this.ok(result, MESSAGE_CODE.SUCCESS);
  }
}
