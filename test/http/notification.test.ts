import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { Application } from "express";

import { getTestApp, loginAs } from "../helpers/http";

/** 通知管理面：批次列表、详情、按角色发送、失败邮件重试。 */
describe("通知中心管理接口", () => {
  let app: Application;
  let token = "";
  const suffix = Date.now().toString().slice(-8);

  beforeAll(async () => {
    app = await getTestApp();
    token = (await loginAs("superAdmin", "superAdmin123456@")).token;
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("按角色发送通知并读取批次详情", async () => {
    const sent = await request(app)
      .post("/api/v1/notification/admin/send")
      .set(auth())
      .send({
        title: `QA 通知 ${suffix}`,
        content: "这是自动化测试通知。",
        category: "system",
        type: "info",
        audience: { type: "role", roleCodes: ["admin"] },
        sendEmail: false,
      })
      .expect(200);
    expect(sent.body.code).toBe(200);
    const batchId = sent.body.data.batchId as string;
    expect(batchId).toBeTruthy();

    const batches = await request(app)
      .get("/api/v1/notification/admin/batches")
      .set(auth())
      .query({ page: 1, pageSize: 10, keyword: suffix })
      .expect(200);
    expect(batches.body.code).toBe(200);
    expect(Array.isArray(batches.body.data.list)).toBe(true);

    const detail = await request(app)
      .get(`/api/v1/notification/admin/batches/${batchId}`)
      .set(auth())
      .query({ page: 1, pageSize: 10 })
      .expect(200);
    expect(detail.body.code).toBe(200);
    expect(detail.body.data.batch.batchId).toBe(batchId);

    const retryUnknown = await request(app).post("/api/v1/notification/admin/batches/not-exist/retry-email").set(auth());
    expect(retryUnknown.body.code).not.toBe(200);
  });

  it("空受众与非法分类被参数校验拦截", async () => {
    const emptyAudience = await request(app)
      .post("/api/v1/notification/admin/send")
      .set(auth())
      .send({ title: "x", content: "y", audience: { type: "role", roleCodes: [] } });
    expect(emptyAudience.body.code).toBe(10003);

    const badCategory = await request(app)
      .post("/api/v1/notification/admin/send")
      .set(auth())
      .send({ title: "x", content: "y", category: "not-a-category", audience: { type: "all" } });
    expect(badCategory.body.code).toBe(10003);
  });

  it("用户侧列表过滤、未读数与全部已读", async () => {
    const list = await request(app).get("/api/v1/notification/list").set(auth()).query({ page: 1, pageSize: 10, isRead: 1 }).expect(200);
    expect(list.body.code).toBe(200);
    expect(Array.isArray(list.body.data.list)).toBe(true);

    const filtered = await request(app)
      .get("/api/v1/notification/list")
      .set(auth())
      .query({ page: 1, pageSize: 10, isRead: 0, category: "system", type: "info" })
      .expect(200);
    expect(filtered.body.code).toBe(200);

    const badFilter = await request(app).get("/api/v1/notification/list").set(auth()).query({ category: "unknown" });
    expect(badFilter.body.code).toBe(10003);

    const unread = await request(app).get("/api/v1/notification/unread-count").set(auth()).expect(200);
    expect(unread.body.code).toBe(200);
    expect(typeof unread.body.data.count).toBe("number");

    const readAll = await request(app).post("/api/v1/notification/read-all").set(auth()).expect(200);
    expect(readAll.body.code).toBe(200);
  });

  it("全员 / 指定用户受众、批次筛选与参数边界", async () => {
    const sent = await request(app)
      .post("/api/v1/notification/admin/send")
      .set(auth())
      .send({
        title: `QA 全员 ${suffix}`,
        content: "全员通知正文",
        category: "business",
        type: "info",
        audience: { type: "all" },
        link: "https://example.com/qa",
        sendEmail: true,
      })
      .expect(200);
    expect(sent.body.code).toBe(200);
    const batchId = sent.body.data.batchId as string;

    const byCategory = await request(app)
      .get("/api/v1/notification/admin/batches")
      .set(auth())
      .query({ page: 1, pageSize: 10, category: "business", type: "info", source: "admin", keyword: suffix })
      .expect(200);
    expect(byCategory.body.code).toBe(200);

    const badCategory = await request(app).get("/api/v1/notification/admin/batches").set(auth()).query({ category: "unknown" });
    expect(badCategory.body.code).toBe(10003);

    const badPage = await request(app).get("/api/v1/notification/admin/batches").set(auth()).query({ page: 0 });
    expect(badPage.body.code).toBe(10003);

    const badDetailPage = await request(app).get(`/api/v1/notification/admin/batches/${batchId}`).set(auth()).query({ page: 0 });
    expect(badDetailPage.body.code).toBe(10003);

    const badType = await request(app)
      .post("/api/v1/notification/admin/send")
      .set(auth())
      .send({ title: "x", content: "y", type: "unknown", audience: { type: "all" } });
    expect(badType.body.code).toBe(10003);

    const userWithoutIds = await request(app)
      .post("/api/v1/notification/admin/send")
      .set(auth())
      .send({ title: "x", content: "y", audience: { type: "user" } });
    expect(userWithoutIds.body.code).toBe(10003);

    const superAudience = await request(app)
      .post("/api/v1/notification/admin/send")
      .set(auth())
      .send({ title: "x", content: "y", audience: { type: "role", roleCodes: ["superAdmin"] } });
    expect(superAudience.body.code).not.toBe(200);

    const retried = await request(app).post(`/api/v1/notification/admin/batches/${batchId}/retry-email`).set(auth());
    expect([200, 404]).toContain(retried.status);
  });
});
