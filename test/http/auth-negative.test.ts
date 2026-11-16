import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { Application } from "express";

import { getTestApp, loginAs } from "../helpers/http";

/** 认证负向路径：验证码、错误口令、非法刷新、旧密码错误。 */
describe("认证负向路径", () => {
  let app: Application;
  let token = "";

  beforeAll(async () => {
    app = await getTestApp();
    token = (await loginAs("superAdmin", "superAdmin123456@")).token;
  });

  const captcha = async () => {
    const res = await request(app).get("/api/v1/captcha").expect(200);
    return res.body.data as { captchaId: string; devCode: string };
  };

  it("错误验证码与错误口令均被拒绝", async () => {
    const first = await captcha();
    const badCaptcha = await request(app).post("/api/v1/auth/login").send({
      username: "admin",
      password: "123456",
      captchaId: first.captchaId,
      captchaCode: "0000",
    });
    expect(badCaptcha.status).toBeGreaterThanOrEqual(400);
    expect(badCaptcha.body.code).not.toBe(200);

    const second = await captcha();
    const badPassword = await request(app).post("/api/v1/auth/login").send({
      username: "admin",
      password: "wrong-password",
      captchaId: second.captchaId,
      captchaCode: second.devCode,
    });
    expect(badPassword.status).toBeGreaterThanOrEqual(400);
    expect(badPassword.body.code).not.toBe(200);
  });

  it("非法 refresh token 与缺失参数被拒绝", async () => {
    const bad = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: "x".repeat(40) })
      .expect(401);
    expect(bad.body.code).not.toBe(200);

    const missing = await request(app).post("/api/v1/auth/refresh").send({});
    expect(missing.status).toBeGreaterThanOrEqual(400);
    expect(missing.body.code).not.toBe(200);
  });

  it("修改密码：旧密码错误被拒绝，账号状态不变", async () => {
    const wrongOld = await request(app)
      .post("/api/v1/auth/password/change")
      .set("Authorization", `Bearer ${token}`)
      .send({ oldPassword: "not-the-password", newPassword: "Qa@123456" });
    expect(wrongOld.status).toBeGreaterThanOrEqual(400);
    expect(wrongOld.body.code).not.toBe(200);

    const profile = await request(app).post("/api/v1/auth/profile").set("Authorization", `Bearer ${token}`).expect(200);
    expect(profile.body.data.username).toBe("superAdmin");
  });

  it("忘记密码：用户名与邮箱不匹配不泄露账号存在性", async () => {
    const c = await captcha();
    const mismatch = await request(app)
      .post("/api/v1/auth/password/forgot")
      .send({ username: "admin", email: "nobody@example.com", captchaId: c.captchaId, captchaCode: c.devCode });
    expect(mismatch.body.code).not.toBe(200);

    const invalidCode = await request(app)
      .post("/api/v1/auth/password/reset")
      .send({ username: "admin", email: "admin@example.com", code: "000000", newPassword: "Qa@123456" });
    expect(invalidCode.body.code).not.toBe(200);
  });
});
