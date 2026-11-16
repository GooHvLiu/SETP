import { describe, expect, it } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";

import { BusinessError, errorHandler, notFoundHandler } from "../../src/middleware/error.middleware";
import { ERROR_CODE } from "../../src/constants/errorCode";

function fakeRes() {
  const res = {
    statusCode: 0,
    body: {} as Record<string, unknown>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: Record<string, unknown>) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: Record<string, unknown> };
}

function fakeReq(extra: Record<string, unknown> = {}) {
  return { method: "POST", url: "/api/v1/qa", id: "req-qa", ...extra } as unknown as Request;
}

function prismaError(code: string, meta?: Record<string, unknown>) {
  const err = Object.create(Prisma.PrismaClientKnownRequestError.prototype) as Prisma.PrismaClientKnownRequestError;
  Object.assign(err, { name: "PrismaClientKnownRequestError", message: code, code, meta, clientVersion: "7.10.0" });
  return err;
}

/** 全局错误中间件：各类异常到标准错误响应的映射。 */
describe("全局错误处理", () => {
  const run = (err: unknown) => {
    const res = fakeRes();
    errorHandler(err, fakeReq(), res, (() => undefined) as NextFunction);
    return res;
  };

  it("业务错误类保留 code 与 params", () => {
    const res = run(new BusinessError(ERROR_CODE.PARAM_INVALID, "PARAM_INVALID", { field: "username" }));
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe(ERROR_CODE.PARAM_INVALID);
    expect(res.body.params).toEqual({ field: "username" });
    expect(res.body.requestId).toBe("req-qa");
  });

  it("ERROR_MAP 标识、鉴权与令牌错误", () => {
    expect(run(new Error("LOG_CLEANUP_CONFIRM_REQUIRED")).body.code).toBe(92001);
    expect(run(Object.assign(new Error("forbidden"), { name: "Forbidden" })).body.code).toBe(ERROR_CODE.PERMISSION_DENIED);
    expect(run(Object.assign(new Error("expired"), { name: "TokenExpiredError" })).body.code).toBe(ERROR_CODE.TOKEN_EXPIRED);
    expect(run(Object.assign(new Error("bad"), { name: "JsonWebTokenError" })).body.code).toBe(ERROR_CODE.TOKEN_INVALID);
    expect(run(Object.assign(new Error("early"), { name: "NotBeforeError" })).body.code).toBe(ERROR_CODE.TOKEN_INVALID);
    expect(run(Object.assign(new Error("pwd"), { name: "PasswordChangeRequired" })).body.code).toBe(ERROR_CODE.PASSWORD_CHANGE_REQUIRED);
    expect(run(Object.assign(new Error("unauth"), { name: "Unauthorized" })).body.code).toBe(ERROR_CODE.UNAUTHORIZED);
  });

  it("参数校验：TSOA 与 Joi", () => {
    const tsoa = run(Object.assign(new Error("validate"), { name: "ValidateError", fields: { username: {} } }));
    expect(tsoa.body.code).toBe(ERROR_CODE.PARAM_INVALID);
    expect(tsoa.body.params).toEqual({ field: "username" });

    const joi = run(Object.assign(new Error("validate"), { name: "ValidationError", details: [{ path: ["audience", "roleCodes"] }] }));
    expect(joi.body.params).toEqual({ field: "audience.roleCodes" });
  });

  it("Multer：超限与其他上传失败", () => {
    expect(run(Object.assign(new Error("big"), { name: "MulterError", code: "LIMIT_FILE_SIZE" })).body.code).toBe(
      ERROR_CODE.FILE_TOO_LARGE
    );
    expect(run(Object.assign(new Error("other"), { name: "MulterError", code: "LIMIT_UNEXPECTED_FILE" })).body.code).toBe(
      ERROR_CODE.FILE_UPLOAD_FAIL
    );
  });

  it("Prisma：唯一冲突字段、记录不存在与其他数据库错误", () => {
    const conflict = run(prismaError("P2002", { target: ["username"] }));
    expect(conflict.body.code).toBe(ERROR_CODE.DATA_CONFLICT);
    expect(conflict.body.params).toEqual({ field: "username" });

    const conflictText = run(prismaError("P2002", { target: "email" }));
    expect(conflictText.body.params).toEqual({ field: "email" });

    expect(run(prismaError("P2025")).body.code).toBe(ERROR_CODE.NOT_FOUND);
    expect(run(prismaError("P1001")).body.code).toBe(ERROR_CODE.DATABASE_ERROR);
  });

  it("语法/类型错误与未知兜底，404 处理", () => {
    expect(run(new SyntaxError("bad syntax")).body.code).toBe(ERROR_CODE.SYSTEM_ERROR);
    expect(run(new TypeError("bad type")).body.code).toBe(ERROR_CODE.SYSTEM_ERROR);
    expect(run({ message: "unknown" }).body.code).toBe(ERROR_CODE.UNKNOWN_ERROR);
    expect(run({ name: "ValidateError" }).body.code).toBe(ERROR_CODE.UNKNOWN_ERROR);

    const res = fakeRes();
    notFoundHandler(fakeReq(), res);
    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe(ERROR_CODE.NOT_FOUND);
  });
});
