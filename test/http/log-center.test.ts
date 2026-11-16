import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { Application } from "express";

import { getTestApp, loginAs } from "../helpers/http";

/** 日志中心：三类日志筛选、区间概览、清理确认与非法参数。 */
describe("日志中心", () => {
  let app: Application;
  let token = "";

  beforeAll(async () => {
    app = await getTestApp();
    token = (await loginAs("superAdmin", "superAdmin123456@")).token;
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("operation / login / mail 三类日志均可查询并命中过滤条件", async () => {
    for (const category of ["operation", "login", "mail"]) {
      const res = await request(app).get("/api/v1/log-center/list").set(auth()).query({ page: 1, pageSize: 5, category }).expect(200);
      expect(res.body.code).toBe(200);
      expect(Array.isArray(res.body.data.list)).toBe(true);
    }

    const filtered = await request(app)
      .get("/api/v1/log-center/list")
      .set(auth())
      .query({
        page: 1,
        pageSize: 5,
        category: "operation",
        module: "auth",
        action: "login",
        result: "success",
        username: "superAdmin",
        keyword: "login",
        from: "2020-01-01",
        to: "2030-01-01",
      })
      .expect(200);
    expect(filtered.body.code).toBe(200);

    const badCategory = await request(app).get("/api/v1/log-center/list").set(auth()).query({ category: "unknown" });
    expect(badCategory.body.code).toBe(10003);

    const badDate = await request(app).get("/api/v1/log-center/list").set(auth()).query({ from: "not-a-date" });
    expect(badDate.body.code).toBe(10003);
  });

  it("概览支持 24h / 7d / 30d，非法区间被拦截", async () => {
    for (const range of ["24h", "7d", "30d"]) {
      const res = await request(app).get("/api/v1/log-center/summary").set(auth()).query({ range }).expect(200);
      expect(res.body.code).toBe(200);
      expect(res.body.data).toBeTruthy();
    }

    const invalid = await request(app).get("/api/v1/log-center/summary").set(auth()).query({ range: "1y" });
    expect(invalid.body.code).toBe(10003);
  });

  it("清理：确认码错误或天数越界被拒绝，合法清理返回统计", async () => {
    const noConfirm = await request(app).post("/api/v1/log-center/cleanup").set(auth()).send({ beforeDays: 30 });
    expect(noConfirm.body.code).toBe(10003);

    const wrongConfirm = await request(app).post("/api/v1/log-center/cleanup").set(auth()).send({ beforeDays: 30, confirm: "NO" });
    expect(wrongConfirm.body.code).toBe(92001);

    const badDays = await request(app).post("/api/v1/log-center/cleanup").set(auth()).send({ beforeDays: -1, confirm: "CLEANUP" });
    expect(badDays.body.code).toBe(10003);

    const cleaned = await request(app)
      .post("/api/v1/log-center/cleanup")
      .set(auth())
      .send({ beforeDays: 3650, confirm: "CLEANUP" })
      .expect(200);
    expect(cleaned.body.code).toBe(200);
  });
});
