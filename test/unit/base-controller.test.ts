import { describe, expect, it } from "vitest";
import { BaseController } from "../../src/base/BaseController";
import { ERROR_CODE, CODE_TO_MSG } from "../../src/constants/errorCode";
import { STATUS_CODE } from "../../src/constants/statusCode";

/** 响应构造器：默认值、可选 params 与未知错误码兜底。 */
describe("BaseController", () => {
  const controller = new BaseController() as any;

  it("ok 默认 SUCCESS，带 params 时透传", () => {
    const plain = controller.ok({ id: 1 });
    expect(plain).toMatchObject({ code: ERROR_CODE.SUCCESS, msg: CODE_TO_MSG[ERROR_CODE.SUCCESS], data: { id: 1 } });
    expect(plain.params).toBeUndefined();

    const withParams = controller.ok({ id: 2 }, "CREATE_SUCCESS", { id: 2 });
    expect(withParams.params).toEqual({ id: 2 });
    expect(controller.getStatus()).toBe(STATUS_CODE.OK);
  });

  it("fail 自动补全 msg，未知错误码兜底 UNKNOWN_ERROR", () => {
    const known = controller.fail(ERROR_CODE.UNAUTHORIZED);
    expect(known.msg).toBe(CODE_TO_MSG[ERROR_CODE.UNAUTHORIZED]);
    expect(known.data).toBeNull();

    const explicit = controller.fail(ERROR_CODE.PARAM_INVALID, "CUSTOM_MSG", { field: "name" });
    expect(explicit.msg).toBe("CUSTOM_MSG");
    expect(explicit.params).toEqual({ field: "name" });

    const unknown = controller.fail(999999);
    expect(unknown.msg).toBe("UNKNOWN_ERROR");
  });

  it("failWithData 保留业务数据", () => {
    const result = controller.failWithData(ERROR_CODE.USER_NOT_EXIST, { taskId: "qa" }, "TASK_FAILED");
    expect(result).toMatchObject({ code: ERROR_CODE.USER_NOT_EXIST, msg: "TASK_FAILED", data: { taskId: "qa" } });
  });

  it("failJoi 取第一个字段，缺失时回退 param", () => {
    const withField = controller.failJoi({ details: [{ path: ["body", "username"] }] });
    expect(withField.params).toEqual({ field: "body.username" });

    const withoutField = controller.failJoi({});
    expect(withoutField.params).toEqual({ field: "param" });
  });
});
