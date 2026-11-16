import request from "supertest";
import type { Application } from "express";
import { createApp } from "@src/app";
import { initializeRuntime } from "@src/bootstrap";

let app: Application | null = null;

/** 获取已完成的初始化、可直接交给 Supertest 的 Express 实例 */
export async function getTestApp(): Promise<Application> {
  if (!app) {
    app = createApp();
    await initializeRuntime();
  }
  return app;
}

/** 走真实验证码 + 登录闭环，返回 access / refresh token */
export async function loginAs(username: string, password: string): Promise<{ token: string; refreshToken: string }> {
  const instance = await getTestApp();

  const captcha = await request(instance).get("/api/v1/captcha").expect(200);
  const captchaBody = captcha.body as { code: number; data?: { captchaId: string; devCode?: string } };
  if (captchaBody.code !== 200 || !captchaBody.data?.devCode) {
    throw new Error(`获取验证码失败: ${JSON.stringify(captchaBody)}`);
  }

  const login = await request(instance)
    .post("/api/v1/auth/login")
    .send({
      username,
      password,
      captchaId: captchaBody.data.captchaId,
      captchaCode: captchaBody.data.devCode,
    })
    .expect(200);

  const loginBody = login.body as {
    code: number;
    data?: { token: string; refreshToken: string };
  };
  if (loginBody.code !== 200 || !loginBody.data?.token) {
    throw new Error(`登录失败(${username}): ${JSON.stringify(loginBody)}`);
  }

  return { token: loginBody.data.token, refreshToken: loginBody.data.refreshToken };
}
