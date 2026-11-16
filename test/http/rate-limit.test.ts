import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import responseMiddleware from "@src/middleware/response.middleware";
import { createRateLimiter } from "@src/middleware/rateLimit.middleware";

/** 限流器最小闭环：超过阈值返回 HTTP 429 + 统一错误结构。 */
describe("限流", () => {
  it("超过窗口阈值返回 429 与 TOO_MANY_REQUESTS", async () => {
    const app = express();
    app.use(responseMiddleware);
    app.use(createRateLimiter({ windowMs: 60_000, max: 2 }));
    app.get("/probe", (_req, res) => res.success({ ok: true }, "SUCCESS"));

    await request(app).get("/probe").expect(200);
    await request(app).get("/probe").expect(200);
    const limited = await request(app).get("/probe").expect(429);
    expect(limited.body.code).toBe(10106);
    expect(limited.body.msg).toBe("TOO_MANY_REQUESTS");
  });
});
