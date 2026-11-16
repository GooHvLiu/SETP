import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getTestApp } from "../helpers/http";
import { prisma } from "../../src/db/prisma";

describe("健康检查", () => {
  it("GET / 返回统一响应结构", async () => {
    const app = await getTestApp();
    const res = await request(app).get("/").expect(200);

    expect(res.body).toMatchObject({
      code: 200,
      data: { state: "Connected Success" },
    });
    expect(typeof res.body.msg).toBe("string");
    expect(typeof res.body.data.time).toBe("number");
  });

  it("GET /live 与 /ready 分离：存活不触库，就绪校验数据库", async () => {
    const app = await getTestApp();

    const live = await request(app).get("/live").expect(200);
    expect(live.body.code).toBe(200);
    expect(live.body.data.status).toBe("alive");
    expect(typeof live.body.data.uptimeSec).toBe("number");

    const ready = await request(app).get("/ready").expect(200);
    expect(ready.body.code).toBe(200);
    expect(ready.body.data).toMatchObject({ status: "ready", database: "ok" });
    expect(typeof ready.body.data.durationMs).toBe("number");
  });

  it("GET /ready 在数据库不可用时返回 503，存活探针不受影响", async () => {
    const app = await getTestApp();
    const spy = vi.spyOn(prisma, "$queryRawUnsafe").mockRejectedValueOnce(new Error("connection lost"));

    const affected = await request(app).get("/ready").expect(503);
    expect(affected.body.code).toBe(503);
    expect(affected.body.data).toMatchObject({ status: "not-ready", database: "fail" });

    spy.mockRestore();
    const live = await request(app).get("/live").expect(200);
    expect(live.body.data.status).toBe("alive");
  });
});
