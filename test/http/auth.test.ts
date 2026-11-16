import { describe, expect, it } from "vitest";
import request from "supertest";
import { getTestApp, loginAs } from "../helpers/http";

describe("认证闭环", () => {
  it("验证码 + 登录 + profile + 刷新轮换 + 登出", async () => {
    const app = await getTestApp();
    const session = await loginAs("admin", "123456");

    const profile = await request(app).post("/api/v1/auth/profile").set("Authorization", `Bearer ${session.token}`).expect(200);
    expect(profile.body.code).toBe(200);
    expect(profile.body.data.username).toBe("admin");

    const refreshed = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(200);
    expect(refreshed.body.code).toBe(200);
    expect(typeof refreshed.body.data.token).toBe("string");
    expect(typeof refreshed.body.data.refreshToken).toBe("string");
    expect(refreshed.body.data.refreshToken).not.toBe(session.refreshToken);

    // 轮换后旧 access 的会话已被吊销，新 access 指向新会话
    const oldAccess = await request(app).post("/api/v1/auth/profile").set("Authorization", `Bearer ${session.token}`);
    expect(oldAccess.status).toBe(401);
    const newProfile = await request(app)
      .post("/api/v1/auth/profile")
      .set("Authorization", `Bearer ${refreshed.body.data.token}`)
      .expect(200);
    expect(newProfile.body.code).toBe(200);

    await request(app).post("/api/v1/auth/logout").set("Authorization", `Bearer ${refreshed.body.data.token}`).expect(200);

    // 登出会吊销该用户全部会话，旧 refresh 与新 refresh 都立即失效
    const afterLogout = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(401);
    expect(afterLogout.body.code).not.toBe(200);
    const rotatedAfterLogout = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: refreshed.body.data.refreshToken })
      .expect(401);
    expect(rotatedAfterLogout.body.code).not.toBe(200);
  });

  it("刷新令牌被重放时吊销该用户全部会话", async () => {
    const app = await getTestApp();
    const session = await loginAs("admin", "123456");
    const refreshed = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(200);
    const newRefreshToken = refreshed.body.data.refreshToken as string;

    // 旧 token 二次使用按重放处理，返回 401 并吊销全部未吊销会话
    const reused = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(401);
    expect(reused.body.code).not.toBe(200);

    const newSessionRejected = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: newRefreshToken }).expect(401);
    expect(newSessionRejected.body.code).not.toBe(200);
  });

  it("无 token 访问受保护接口返回 10101", async () => {
    const app = await getTestApp();
    const res = await request(app).post("/api/v1/auth/profile").expect(401);
    expect(res.body.code).toBe(10101);
  });
});
