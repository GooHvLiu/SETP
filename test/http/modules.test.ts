import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Application } from "express";

import { getTestApp, loginAs } from "../helpers/http";

let app: Application;
let token: string;

const protectedGets = [
  "/api/v1/user/list",
  "/api/v1/role/list",
  "/api/v1/menu/tree",
  "/api/v1/menu/list",
  "/api/v1/menu/deleted",
  "/api/v1/dict/all",
  "/api/v1/dict/admin/types",
  "/api/v1/config/public",
  "/api/v1/config/all",
  "/api/v1/notification/list",
  "/api/v1/notification/unread-count",
  "/api/v1/notification/admin/batches",
  "/api/v1/operate-log/list",
  "/api/v1/log-center/list",
  "/api/v1/log-center/summary",
  "/api/v1/super-admin/metrics/overview",
  "/api/v1/super-admin/health/checks",
  "/api/v1/super-admin/ops/tasks",
  "/api/v1/super-admin/sessions",
  "/api/v1/super-admin/settings",
  "/api/v1/help/tree",
  "/api/v1/help/mode",
  "/api/v1/help/ai-health",
  "/api/v1/help/admin/docs",
];

beforeAll(async () => {
  app = await getTestApp();
  token = (await loginAs("superAdmin", "superAdmin123456@")).token;
});

describe("受保护查询接口", () => {
  it.each(protectedGets)("%s 返回统一成功结构", async (url) => {
    const res = await request(app).get(url).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(200);
  });
});

describe("参数校验与资源边界", () => {
  it("缺少登录参数时返回 4xx 且不泄露内部错误", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.code).not.toBe(200);
  });

  it("访问不存在的用户返回 4xx", async () => {
    const res = await request(app).get("/api/v1/user/999999").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.code).not.toBe(200);
  });

  it("帮助中心路径穿越被拒绝", async () => {
    const res = await request(app)
      .get("/api/v1/help/article")
      .query({ path: "../../../etc/passwd" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.code).not.toBe(200);
  });
});
