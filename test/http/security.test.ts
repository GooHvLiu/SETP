import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { Application } from "express";
import { getTestApp, loginAs } from "../helpers/http";
import jwtConfig from "../../src/config/jwt.config";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("安全边界：未登录、坏 token、强制改密、角色越权", () => {
  let app: Application;
  let token = "";

  beforeAll(async () => {
    app = await getTestApp();
    token = (await loginAs("superAdmin", "superAdmin123456@")).token;
  });

  it("无 token 与非法 token 均被拒绝", async () => {
    const anonymous = await request(app).get("/api/v1/user/list");
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.code).toBe(10101);

    const garbage = await request(app).get("/api/v1/user/list").set(auth("not-a-jwt"));
    expect(garbage.status).toBe(401);
    expect(garbage.body.code).not.toBe(200);

    const expired = jwt.sign({ userId: 1, username: "admin", sid: 1, type: "access", v: 0 }, jwtConfig.secret, {
      expiresIn: -1,
    });
    const expiredRes = await request(app).get("/api/v1/user/list").set(auth(expired));
    expect(expiredRes.status).toBe(401);
    expect(expiredRes.body.code).not.toBe(200);
  });

  it("新建用户首次登录只能访问白名单接口", async () => {
    const username = `qa_guard_${Date.now()}`;
    const created = await request(app)
      .post("/api/v1/user")
      .set(auth(token))
      .send({ username, password: "Qa@123456", realName: "门禁用例", email: `${username}@example.com` })
      .expect(200);
    expect(created.body.code).toBe(200);
    const userId = created.body.data.id as number;

    const login = await loginAs(username, "Qa@123456");

    const blocked = await request(app).get("/api/v1/user/list").set(auth(login.token));
    expect(blocked.status).not.toBe(200);
    expect(blocked.body.code).not.toBe(200);

    const profile = await request(app).post("/api/v1/auth/profile").set(auth(login.token)).expect(200);
    expect(profile.body.code).toBe(200);

    const removed = await request(app)
      .post("/api/v1/user/batch-delete")
      .set(auth(token))
      .send({ ids: [userId] })
      .expect(200);
    expect(removed.body.code).toBe(200);
  });

  it("角色 × 接口越权矩阵：admin 不得进入超管域", async () => {
    const admin = await loginAs("admin", "123456");
    const cases = [
      { path: "/api/v1/menu/list", superAdminStatus: 200 },
      { path: "/api/v1/super-admin/health/checks", superAdminStatus: 200 },
      { path: "/api/v1/super-admin/ops/tasks", superAdminStatus: 200 },
      { path: "/api/v1/super-admin/sessions", superAdminStatus: 200 },
    ];

    for (const item of cases) {
      const superAdminRes = await request(app).get(item.path).set(auth(token));
      expect(superAdminRes.status).toBe(item.superAdminStatus);
      expect(superAdminRes.body.code).toBe(200);

      const adminRes = await request(app).get(item.path).set(auth(admin.token));
      expect(adminRes.status).toBe(403);
      expect(adminRes.body.code).toBe(10104);
    }
  });
});
