/**
 * ============================================================
 * 文件上传控制器（modules/upload/upload.controller.ts）
 * ------------------------------------------------------------
 * TSOA 版本：上传接口需要配合 multer 中间件
 * 说明：TSOA 框架下文件上传需在 @Route 类上挂 @Middleware(upload.single('file'))
 *      或由路由层处理；这里提供标准写法
 * ============================================================
 */

import { Route, Tags, Post, UploadedFile, Security, Response } from "tsoa";
import { BaseController } from "../../base/BaseController";
import { UploadResultDto } from "./upload.model";
import { upload } from "../../middleware/upload.middleware";
import uploadConfig from "../../config/upload.config";
import { MESSAGE_CODE } from "../../constants/messageCode";
import { ERROR_CODE } from "../../constants/errorCode";
import { ApiResponse } from "../../types";

@Route("api/v1/upload")
@Tags("Upload - 上传中心")
export class UploadController extends BaseController {
  /**
   * 上传单个文件
   * 请求方式：multipart/form-data，字段名 file
   */
  @Post("file")
  @Security("bearerAuth")
  @Response<{ message: string }>(400, "文件为空或类型不允许（业务码见响应体 code）")
  public async uploadFile(@UploadedFile() file: Express.Multer.File | undefined): Promise<ApiResponse<UploadResultDto>> {
    if (!file) {
      return this.fail(ERROR_CODE.FILE_NOT_EXIST);
    }

    return this.ok(
      {
        url: `/uploads/${file.filename}`,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
      },
      MESSAGE_CODE.UPLOAD_SUCCESS
    );
  }
}

// 导出 multer 实例供路由层挂载（如需要）
export { upload, uploadConfig };
