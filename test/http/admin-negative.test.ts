import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { Application } from "express";

import { getTestApp, loginAs } from "../helpers/http";

/** 管理端负向路径：重复、保留名、弱密码、越权、缺失资源。 */
describe("用户管理负向路径", () => {
  let app: Application;
  let token = "";
  const suffix = Date.now().toString().slice(-8);
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const notOk = (body: { code?: number }) => expect(body.code).not.toBe(200);

  beforeAll(async () => {
    app = await getTestApp();
    token = (await loginAs("superAdmin", "superAdmin123456@")).token;
  });

  it("创建用户：重复用户名、保留名、弱密码、非法角色全部拒绝", async () => {
    const username = `neg_${suffix}`;
    const created = await request(app)
      .post("/api/v1/user")
      .set(auth())
      .send({ username, password: "Qa@123456", email: `${username}@test.com` })
      .expect(200);
    expect(created.body.code).toBe(200);

    const duplicate = await request(app)
      .post("/api/v1/user")
      .set(auth())
      .send({ username, password: "Qa@123456", email: `${username}2@test.com` });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe(20002);
    expect(duplicate.body.params.field).toBe("username");

    const reserved = await request(app)
      .post("/api/v1/user")
      .set(auth())
      .send({ username: "superAdmin", password: "Qa@123456", email: "reserved@test.com" });
    expect(reserved.status).toBe(409);
    expect(reserved.body.code).toBe(20002);
    expect(reserved.body.params.field).toBe("username");

    const weak = await request(app)
      .post("/api/v1/user")
      .set(auth())
      .send({ username: `weak_${suffix}`, password: "123456", email: `weak_${suffix}@test.com` })
      .expect(422);
    expect(weak.body.code).toBe(10003);
    expect(weak.body.params.field).toBe("password");

    const badRole = await request(app)
      .post("/api/v1/user")
      .set(auth())
      .send({ username: `role_${suffix}`, password: "Qa@123456", email: `role_${suffix}@test.com`, roleCodes: ["not-exist"] });
    notOk(badRole.body);

    await request(app)
      .post("/api/v1/user/batch-delete")
      .set(auth())
      .send({ ids: [created.body.data.id] })
      .expect(200);
  });

  it("更新用户：重复用户名、弱密码、空角色、缺失资源全部拒绝", async () => {
    const username = `upd_${suffix}`;
    const created = await request(app)
      .post("/api/v1/user")
      .set(auth())
      .send({ username, password: "Qa@123456", email: `${username}@test.com` })
      .expect(200);
    const userId = created.body.data.id as number;

    const duplicate = await request(app).put(`/api/v1/user/${userId}`).set(auth()).send({ username: "admin" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe(20002);
    expect(duplicate.body.params.field).toBe("username");

    const weak = await request(app).put(`/api/v1/user/${userId}`).set(auth()).send({ password: "123456" }).expect(422);
    expect(weak.body.code).toBe(10003);
    expect(weak.body.params.field).toBe("password");

    const badRole = await request(app)
      .put(`/api/v1/user/${userId}`)
      .set(auth())
      .send({ roleCodes: ["superAdmin"] });
    notOk(badRole.body);

    const missing = await request(app).put("/api/v1/user/99999999").set(auth()).send({ realName: "missing" });
    notOk(missing.body);

    await request(app)
      .post("/api/v1/user/batch-delete")
      .set(auth())
      .send({ ids: [userId] })
      .expect(200);
  });

  it("保护边界：超管不可重置、admin 不可自禁用、缺失审批/删除拒绝", async () => {
    const superProfile = await request(app).post("/api/v1/auth/profile").set(auth()).expect(200);
    const superId = superProfile.body.data.id as number;

    const resetSuper = await request(app).post(`/api/v1/user/${superId}/reset-password`).set(auth());
    expect([403, 404]).toContain(resetSuper.status);

    const admin = await loginAs("admin", "123456");
    const adminProfile = await request(app)
      .post("/api/v1/auth/profile")
      .set({ Authorization: `Bearer ${admin.token}` })
      .expect(200);
    const adminId = adminProfile.body.data.id as number;
    const disableSelf = await request(app)
      .put(`/api/v1/user/${adminId}`)
      .set({ Authorization: `Bearer ${admin.token}` })
      .send({ status: 0 });
    notOk(disableSelf.body);

    const missingApprove = await request(app).post("/api/v1/user/99999999/approve").set(auth());
    notOk(missingApprove.body);
    const missingReject = await request(app).post("/api/v1/user/99999999/reject").set(auth());
    notOk(missingReject.body);
    const missingDelete = await request(app).delete("/api/v1/user/99999999").set(auth());
    expect([404, 400]).toContain(missingDelete.status);
    notOk(missingDelete.body);
  });

  it("参数校验：非法邮箱与空批量删除返回统一错误", async () => {
    const badEmail = await request(app)
      .post("/api/v1/user")
      .set(auth())
      .send({ username: `mail_${suffix}`, password: "Qa@123456", email: "not-an-email" })
      .expect(422);
    expect(badEmail.body.code).toBe(10003);

    const emptyBatch = await request(app).post("/api/v1/user/batch-delete").set(auth()).send({ ids: [] });
    notOk(emptyBatch.body);
  });
});
