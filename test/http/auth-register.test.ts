import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Application } from "express";
import { getTestApp, loginAs } from "../helpers/http";

const ok = (body: { code?: number }) => expect(body.code).toBe(200);

describe("自助注册与审核", () => {
  let app: Application;
  let token = "";
  const suffix = Date.now().toString().slice(-8);
  const username = `qa_reg_${suffix}`;
  const password = "Qa@123456";

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await getTestApp();
    token = (await loginAs("superAdmin", "superAdmin123456@")).token;
  });

  it("注册开关、弱密码、重复拦截、keyed 通知、审核通过、清理", async () => {
    const disable = await request(app).put("/api/v1/config").set(auth()).send({ key: "register_enabled", value: "false" }).expect(200);
    ok(disable.body);

    const closed = await request(app)
      .post("/api/v1/auth/register")
      .send({ username, password, email: `${username}@example.com`, realName: "QA 注册用户" });
    expect(closed.status).toBe(403);
    expect(closed.body.code).toBe(20013);

    const enable = await request(app).put("/api/v1/config").set(auth()).send({ key: "register_enabled", value: "true" }).expect(200);
    ok(enable.body);

    const weak = await request(app)
      .post("/api/v1/auth/register")
      .send({ username, password: "12345678", email: `${username}@example.com` });
    expect(weak.status).toBe(422);
    expect(weak.body.code).toBe(20005);
    expect(weak.body.params.field).toBe("password");

    const registered = await request(app)
      .post("/api/v1/auth/register")
      .send({ username, password, email: `${username}@example.com`, realName: "QA 注册用户" })
      .expect(200);
    ok(registered.body);

    type KeyedNotice = { titleKey?: string | null; contentKey?: string | null; data?: { username?: string } };
    let registerNotice: KeyedNotice | undefined;
    for (let attempt = 0; attempt < 10 && !registerNotice; attempt += 1) {
      const notices = await request(app).get("/api/v1/notification/list").set(auth()).query({ page: 1, pageSize: 100 }).expect(200);
      registerNotice = (notices.body.data.list as KeyedNotice[]).find(
        (item) => item.titleKey === "notification.auth.registerPending.title" && item.data?.username === username
      );
      if (!registerNotice) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(registerNotice).toBeTruthy();
    expect(registerNotice!.contentKey).toBe("notification.auth.registerPending.content");
    expect(registerNotice!.data?.username).toBe(username);

    const duplicated = await request(app)
      .post("/api/v1/auth/register")
      .send({ username, password, email: `${username}@example.com` });
    expect(duplicated.status).toBe(409);
    expect(duplicated.body.code).toBe(20002);
    expect(duplicated.body.params.field).toBe("username");

    const loginBeforeApprove = await request(app)
      .post("/api/v1/auth/login")
      .send({ username, password, captchaId: "qa", captchaCode: "qa" });
    expect(loginBeforeApprove.body.code).not.toBe(200);

    const users = await request(app).get("/api/v1/user/list").set(auth()).query({ username, page: 1, pageSize: 10 }).expect(200);
    ok(users.body);
    const target = (users.body.data.list as Array<{ id: number; username: string }>).find((item) => item.username === username);
    expect(target).toBeTruthy();

    const approved = await request(app).post(`/api/v1/user/${target!.id}/approve`).set(auth()).expect(200);
    ok(approved.body);

    const userSession = await loginAs(username, password);
    const changed = await request(app)
      .post("/api/v1/auth/password/change")
      .set("Authorization", `Bearer ${userSession.token}`)
      .send({ oldPassword: password, newPassword: "Qa@654321" })
      .expect(200);
    ok(changed.body);

    const staleProfile = await request(app).post("/api/v1/auth/profile").set("Authorization", `Bearer ${userSession.token}`);
    expect(staleProfile.status).toBe(401);

    const newSession = await loginAs(username, "Qa@654321");
    expect(newSession.token).toBeTruthy();

    const reset = await request(app).post(`/api/v1/user/${target!.id}/reset-password`).set(auth()).expect(200);
    ok(reset.body);

    const resetSession = await loginAs(username, "123456");
    expect(resetSession.token).toBeTruthy();

    const removed = await request(app)
      .post("/api/v1/user/batch-delete")
      .set(auth())
      .send({ ids: [target!.id] })
      .expect(200);
    ok(removed.body);

    const restore = await request(app).put("/api/v1/config").set(auth()).send({ key: "register_enabled", value: "false" }).expect(200);
    ok(restore.body);
  });
});
