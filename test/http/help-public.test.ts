import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { Application } from "express";

import { getTestApp, loginAs } from "../helpers/http";

/** 帮助中心公开读接口：默认语言、文档树、文章、模式与 AI 健康。 */
describe("帮助中心公开接口", () => {
  let app: Application;
  let token = "";

  beforeAll(async () => {
    app = await getTestApp();
    token = (await loginAs("superAdmin", "superAdmin123456@")).token;
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("文档树：不传 locale 使用默认语言，显式 locale 返回同构结构", async () => {
    const fallback = await request(app).get("/api/v1/help/tree").set(auth()).expect(200);
    expect(fallback.body.code).toBe(200);
    expect(Array.isArray(fallback.body.data)).toBe(true);

    const explicit = await request(app).get("/api/v1/help/tree").set(auth()).query({ locale: "zh-CN" }).expect(200);
    expect(explicit.body.code).toBe(200);
    expect(Array.isArray(explicit.body.data)).toBe(true);
  });

  it("文章：缺失 path 被参数校验拦截，合法 path 返回正文", async () => {
    const tree = await request(app).get("/api/v1/help/tree").set(auth()).query({ locale: "zh-CN" }).expect(200);
    const firstPath = tree.body.data?.[0]?.chapters?.[0]?.articles?.[0]?.path as string | undefined;

    const missing = await request(app).get("/api/v1/help/article").set(auth()).query({ locale: "zh-CN" });
    expect(missing.body.code).toBe(10003);
    expect(missing.body.msg).toBe("PARAM_INVALID");

    if (firstPath) {
      const article = await request(app).get("/api/v1/help/article").set(auth()).query({ locale: "zh-CN", path: firstPath }).expect(200);
      expect(article.body.code).toBe(200);
      expect(article.body.data.path).toBe(firstPath);
    }
  });

  it("模式与 AI 健康：返回稳定结构，不因 Ollama 不可达而抛错", async () => {
    const mode = await request(app).get("/api/v1/help/mode").set(auth()).expect(200);
    expect(mode.body.code).toBe(200);
    expect(typeof mode.body.data.mode).toBe("string");

    const health = await request(app).get("/api/v1/help/ai-health").set(auth()).expect(200);
    expect(health.body.code).toBe(200);
    expect(health.body.data).toBeTruthy();
  });

  it("AI 对话：空问题被参数校验拦截", async () => {
    const empty = await request(app).post("/api/v1/help/chat").set(auth()).send({ question: "" });
    expect(empty.body.code).toBe(10003);
    expect(empty.body.msg).toBe("PARAM_INVALID");
  });
});
