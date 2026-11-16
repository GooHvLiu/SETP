import { beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Application } from "express";
import opsTaskService from "@src/modules/opsTask/opsTask.service";
import { getTestApp, loginAs } from "../helpers/http";

const ok = (body: { code?: number }) => expect(body.code).toBe(200);

describe("帮助索引与会话运维", () => {
  let app: Application;
  let token = "";

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await getTestApp();
    token = (await loginAs("superAdmin", "superAdmin123456@")).token;
  });

  it("重建帮助索引", async () => {
    const rebuilt = await request(app).post("/api/v1/help/admin/reindex").set(auth()).expect(200);
    ok(rebuilt.body);
  });

  it("运维任务：清理、索引、备份与非法任务", async () => {
    for (const key of ["session-cleanup", "help-reindex", "db-backup"]) {
      const run = await request(app).post(`/api/v1/super-admin/ops/tasks/${key}/run`).set(auth()).expect(200);
      ok(run.body);
    }

    const invalid = await request(app).post("/api/v1/super-admin/ops/tasks/qa-invalid/run").set(auth());
    expect(invalid.body.code).not.toBe(200);
  });

  it("运维任务失败返回 504 + 60006 + data.status=failed", async () => {
    const spy = vi.spyOn(opsTaskService, "run").mockResolvedValue({
      key: "session-cleanup",
      status: "failed",
      startedAt: new Date().toISOString(),
      durationMs: 0,
      messageKey: "opsTask.sessionCleanup.failed",
      params: { reason: "QA_FORCED_FAILURE" },
    });

    let failed;
    try {
      failed = await request(app).post("/api/v1/super-admin/ops/tasks/session-cleanup/run").set(auth());
    } finally {
      spy.mockRestore();
    }

    expect(failed.status).toBe(504);
    expect(failed.body.code).toBe(60006);
    expect(failed.body.data.status).toBe("failed");
    expect(failed.body.params.reason).toBe("QA_FORCED_FAILURE");
  });

  it("会话列表与清理、非法会话吊销", async () => {
    const list = await request(app)
      .get("/api/v1/super-admin/sessions")
      .set(auth())
      .query({ page: 1, pageSize: 10, status: "active" })
      .expect(200);
    ok(list.body);

    const cleanup = await request(app).post("/api/v1/super-admin/sessions/cleanup").set(auth()).send({ beforeDays: 7 }).expect(200);
    ok(cleanup.body);

    const batch = await request(app)
      .post("/api/v1/super-admin/sessions/revoke-batch")
      .set(auth())
      .send({ ids: [999999999], force: false })
      .expect(200);
    ok(batch.body);

    const single = await request(app).post("/api/v1/super-admin/sessions/999999999/revoke").set(auth()).send({ force: false });
    expect(single.body).toBeTruthy();
  });
});
