/**
 * 响应契约自检（test/verify-response-contract.ts）
 * 运行：node node_modules/tsx/dist/cli.mjs test/verify-response-contract.ts
 * 覆盖：成功/失败状态码、params 插值、requestId、错误中间件各分支
 */

import { Prisma } from "@prisma/client";
import { BaseController } from "../src/base/BaseController";
import { ERROR_CODE } from "../src/constants/errorCode";
import { MESSAGE_CODE } from "../src/constants/messageCode";
import { STATUS_CODE } from "../src/constants/statusCode";
import responseMiddleware from "../src/middleware/response.middleware";
import { BusinessError, errorHandler, notFoundHandler } from "../src/middleware/error.middleware";
import { httpStatusForCode } from "../src/constants/httpStatus";

class TestController extends BaseController {
  okTest(data: unknown) {
    return this.ok(data);
  }
  failTest(code: number) {
    return this.fail(code);
  }
  failJoiTest(field: string) {
    return this.failJoi({ details: [{ path: [field] }] });
  }
}

function makeRes() {
  const res: any = {
    statusCode: 0,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    setHeader() {
      return this;
    },
    locals: {},
  };
  return res;
}

const req: any = { method: "GET", url: "/__contract", headers: {}, id: "req-contract" };
let failures = 0;

function assert(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`, ok ? "" : { actual, expected });
  if (!ok) failures += 1;
}

const controller = new TestController();
assert("ok.code", controller.okTest({}).code, ERROR_CODE.SUCCESS);
assert("ok.msg", controller.okTest({}).msg, MESSAGE_CODE.SUCCESS);
assert("ok.status", controller.getStatus(), STATUS_CODE.OK);
assert("fail.status", (controller.failTest(ERROR_CODE.PERMISSION_DENIED), controller.getStatus()), STATUS_CODE.FORBIDDEN);
assert("fail.msg", controller.failTest(ERROR_CODE.PERMISSION_DENIED).msg, "PERMISSION_DENIED");
assert("failJoi.status", (controller.failJoiTest("username"), controller.getStatus()), STATUS_CODE.UNPROCESSABLE_ENTITY);
assert("failJoi.params", controller.failJoiTest("username").params, { field: "username" });

const res = makeRes();
const next = () => undefined;
responseMiddleware(req, res, next);
res.error(ERROR_CODE.TOO_MANY_REQUESTS);
assert("res.error.status", res.statusCode, STATUS_CODE.TOO_MANY_REQUESTS);
assert("res.error.code", res.body.code, ERROR_CODE.TOO_MANY_REQUESTS);
assert("res.error.requestId", res.body.requestId, "req-contract");

const resBusiness = makeRes();
errorHandler(new BusinessError(ERROR_CODE.PARAM_INVALID, "PARAM_INVALID", { field: "name" }), req, resBusiness, next);
assert("BusinessError.status", resBusiness.statusCode, STATUS_CODE.UNPROCESSABLE_ENTITY);
assert("BusinessError.params", resBusiness.body.params, { field: "name" });
assert("BusinessError.requestId", resBusiness.body.requestId, "req-contract");

const resTuple = makeRes();
errorHandler(new Error("USER_NOT_EXIST"), req, resTuple, next);
assert("ERROR_MAP.status", resTuple.statusCode, STATUS_CODE.NOT_FOUND);

const resPrisma = makeRes();
errorHandler(
  new Prisma.PrismaClientKnownRequestError("Unique constraint", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: ["email"] },
  }),
  req,
  resPrisma,
  next
);
assert("P2002.status", resPrisma.statusCode, STATUS_CODE.CONFLICT);
assert("P2002.code", resPrisma.body.code, ERROR_CODE.DATA_CONFLICT);
assert("P2002.field", resPrisma.body.params, { field: "email" });

const res404 = makeRes();
notFoundHandler(req, res404);
assert("404.status", res404.statusCode, STATUS_CODE.NOT_FOUND);

assert("TASK_EXEC_FAILED.status", httpStatusForCode(ERROR_CODE.TASK_EXEC_FAILED), STATUS_CODE.GATEWAY_TIMEOUT);

if (failures > 0) {
  console.error(`响应契约自检失败 ${failures} 项`);
  process.exit(1);
}
console.log("响应契约自检全部通过");
