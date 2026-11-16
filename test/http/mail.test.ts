import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { Application } from "express";

import { getTestApp, loginAs } from "../helpers/http";

/** 邮件服务管理面：状态、日志、参数校验。真实 SMTP 依赖外部账号，不在自动化里发信。 */
describe("邮件服务管理接口", () => {
  let app: Application;
  let token = "";

  beforeAll(async () => {
    app = await getTestApp();
    token = (await loginAs("superAdmin", "superAdmin123456@")).token;
  });

  it("状态与日志接口可用，敏感字段不返回明文", async () => {
    const status = await request(app).get("/api/v1/super-admin/settings/mail/status").set("Authorization", `Bearer ${token}`).expect(200);
    expect(status.body.code).toBe(200);
    expect(status.body.data).toBeTruthy();
    expect(JSON.stringify(status.body)).not.toContain("smtpPassword");

    const logs = await request(app)
      .get("/api/v1/super-admin/settings/mail/logs")
      .query({ limit: 5 })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(logs.body.code).toBe(200);
    expect(Array.isArray(logs.body.data)).toBe(true);
  });

  it("非法 mode 与非法收件人被参数校验拦截", async () => {
    const badMode = await request(app)
      .post("/api/v1/super-admin/settings/mail/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ mode: "invalid-mode" });
    expect(badMode.body.code).toBe(10003);
    expect(badMode.body.msg).toBe("PARAM_INVALID");

    const badRecipient = await request(app)
      .post("/api/v1/super-admin/settings/mail/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ mode: "verify", to: "not-an-email" });
    expect(badRecipient.body.code).toBe(10003);
    expect(badRecipient.body.msg).toBe("PARAM_INVALID");
  });

  it("未配置 SMTP 时 send / verify 返回失败结果而非抛错", async () => {
    for (const mode of ["send", "verify"]) {
      const res = await request(app).post("/api/v1/super-admin/settings/mail/test").set("Authorization", `Bearer ${token}`).send({ mode });
      expect([200, 90001]).toContain(res.body.code);
      if (res.body.code === 200) expect(res.body.data.status).not.toBe("sent");
    }

    const filtered = await request(app)
      .get("/api/v1/super-admin/settings/mail/logs")
      .query({ limit: 5, template: "test" })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(filtered.body.code).toBe(200);
  });
});
