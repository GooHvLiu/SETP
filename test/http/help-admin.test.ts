import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Application } from "express";
import { getTestApp, loginAs } from "../helpers/http";

const ok = (body: { code?: number }) => expect(body.code).toBe(200);

describe("帮助中心管理端", () => {
  let app: Application;
  let token = "";
  const suffix = Date.now().toString().slice(-8);
  const locale = `qa-${suffix}`;
  const docKey = `qa-doc-${suffix}`;
  const docFile = `qa/${suffix}.md`;

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await getTestApp();
    token = (await loginAs("superAdmin", "superAdmin123456@")).token;
  });

  it("语言、文档位、正文上传、索引与清理闭环", async () => {
    const initialized = await request(app)
      .post(`/api/v1/help/admin/locales/${locale}/init`)
      .set(auth())
      .query({ title: `QA 语言 ${suffix}` })
      .expect(200);
    ok(initialized.body);

    const locales = await request(app).get("/api/v1/help/admin/locales").set(auth()).expect(200);
    ok(locales.body);

    const created = await request(app)
      .post("/api/v1/help/admin/slots")
      .set(auth())
      .send({
        locale,
        sectionKey: "qa",
        sectionTitle: "QA 版块",
        sectionSource: "custom",
        key: docKey,
        title: "QA 文档",
        summary: "自动化测试文档位",
        file: docFile,
        contentType: "md",
      })
      .expect(200);
    ok(created.body);

    const slots = await request(app).get("/api/v1/help/admin/slots").set(auth()).query({ locale }).expect(200);
    ok(slots.body);

    const options = await request(app)
      .get("/api/v1/help/admin/slots/file-options")
      .set(auth())
      .query({ locale, keyword: suffix, page: 1, pageSize: 20 })
      .expect(200);
    ok(options.body);

    const detail = await request(app).get(`/api/v1/help/admin/slots/${docKey}`).set(auth()).query({ locale }).expect(200);
    ok(detail.body);

    const updated = await request(app)
      .put(`/api/v1/help/admin/slots/${docKey}`)
      .set(auth())
      .send({ locale, title: "QA 文档-改", summary: "改后的摘要", sort: 9, path: `qa-${suffix}/index` })
      .expect(200);
    ok(updated.body);

    const uploaded = await request(app)
      .put(`/api/v1/help/admin/slots/${docKey}/content`)
      .set(auth())
      .query({ locale })
      .attach("file", Buffer.from(`# QA 文档 ${suffix}\n\n这是自动化测试写入的正文。`, "utf8"), "qa.md")
      .expect(200);
    ok(uploaded.body);

    const content = await request(app).get(`/api/v1/help/admin/slots/${docKey}/content`).set(auth()).query({ locale }).expect(200);
    ok(content.body);
    expect(JSON.stringify(content.body.data)).toContain(String(suffix));

    await request(app).get(`/api/v1/help/admin/slots/${docKey}/file`).set(auth()).query({ locale }).expect(200);

    const indexStatus = await request(app).get("/api/v1/help/admin/index/status").set(auth()).query({ locale }).expect(200);
    ok(indexStatus.body);

    const renamed = await request(app).patch(`/api/v1/help/admin/locales/${locale}`).set(auth()).send({ title: "QA 语言-改" }).expect(200);
    ok(renamed.body);

    const cleared = await request(app)
      .delete(`/api/v1/help/admin/slots/${docKey}/content`)
      .set(auth())
      .query({ locale, confirm: docKey })
      .expect(200);
    ok(cleared.body);

    const removed = await request(app)
      .delete(`/api/v1/help/admin/slots/${docKey}`)
      .set(auth())
      .query({ locale, confirm: docKey })
      .expect(200);
    ok(removed.body);

    const localeRemoved = await request(app)
      .delete(`/api/v1/help/admin/locales/${locale}`)
      .set(auth())
      .query({ confirm: locale })
      .expect(200);
    ok(localeRemoved.body);
  });

  it("管理端负向分支：语言冲突、确认缺失、槽位冲突与非法类型", async () => {
    const badLocale = `qa-${suffix}`;
    const badDoc = `qa-bad-doc-${suffix}`;
    const conflictTarget = `qc-${suffix.slice(-6)}`;

    await request(app).post(`/api/v1/help/admin/locales/${badLocale}/init`).set(auth()).query({ title: "QA 负向" }).expect(200);
    await request(app).post(`/api/v1/help/admin/locales/${conflictTarget}/init`).set(auth()).query({ title: "QA 冲突目标" }).expect(200);

    const initAgain = await request(app).post(`/api/v1/help/admin/locales/${badLocale}/init`).set(auth());
    expect([200, 409, 422, 500]).toContain(initAgain.status);

    const missingLocale = await request(app).patch("/api/v1/help/admin/locales/not-exist-locale").set(auth()).send({ title: "x" });
    expect(missingLocale.body.code).not.toBe(200);

    const conflictLocale = await request(app)
      .patch(`/api/v1/help/admin/locales/${badLocale}`)
      .set(auth())
      .send({ newLocale: conflictTarget });
    expect(conflictLocale.body.code).not.toBe(200);

    const deleteNoConfirm = await request(app).delete(`/api/v1/help/admin/locales/${badLocale}`).set(auth());
    expect(deleteNoConfirm.body.code).not.toBe(200);

    const missingSlot = await request(app).get("/api/v1/help/admin/slots/not-exist-slot").set(auth()).query({ locale: badLocale });
    expect(missingSlot.body.code).not.toBe(200);

    const badKey = await request(app)
      .post("/api/v1/help/admin/slots")
      .set(auth())
      .send({ locale: badLocale, sectionKey: "QA", key: badDoc, title: "x", file: `qa/${suffix}.md`, contentType: "md" });
    expect(badKey.body.code).not.toBe(200);

    const mismatchedType = await request(app)
      .post("/api/v1/help/admin/slots")
      .set(auth())
      .send({
        locale: badLocale,
        sectionKey: "qa",
        sectionTitle: "QA",
        key: badDoc,
        title: "x",
        file: `qa/${suffix}.md`,
        contentType: "pdf",
      });
    expect(mismatchedType.body.code).not.toBe(200);

    const created = await request(app)
      .post("/api/v1/help/admin/slots")
      .set(auth())
      .send({
        locale: badLocale,
        sectionKey: "qa",
        sectionTitle: "QA",
        key: badDoc,
        title: "x",
        file: `qa/${suffix}.md`,
        contentType: "md",
      })
      .expect(200);
    ok(created.body);

    const duplicate = await request(app)
      .post("/api/v1/help/admin/slots")
      .set(auth())
      .send({ locale: badLocale, sectionKey: "qa", key: badDoc, title: "y", file: `qa/${suffix}-2.md`, contentType: "md" });
    expect(duplicate.body.code).not.toBe(200);

    const emptyTitle = await request(app).put(`/api/v1/help/admin/slots/${badDoc}`).set(auth()).send({ locale: badLocale, title: "   " });
    expect(emptyTitle.body.code).not.toBe(200);

    const badSort = await request(app).put(`/api/v1/help/admin/slots/${badDoc}`).set(auth()).send({ locale: badLocale, sort: 10000 });
    expect(badSort.body.code).not.toBe(200);

    const wrongFileType = await request(app)
      .put(`/api/v1/help/admin/slots/${badDoc}/content`)
      .set(auth())
      .query({ locale: badLocale })
      .attach("file", Buffer.from("plain", "utf8"), "qa.txt");
    expect(wrongFileType.status).not.toBe(200);

    const mismatchUpload = await request(app)
      .put(`/api/v1/help/admin/slots/${badDoc}/content`)
      .set(auth())
      .query({ locale: badLocale })
      .attach("file", Buffer.from("%PDF-1.4", "utf8"), "qa.pdf");
    expect(mismatchUpload.body.code).not.toBe(200);

    const clearNoConfirm = await request(app).delete(`/api/v1/help/admin/slots/${badDoc}/content`).set(auth()).query({ locale: badLocale });
    expect(clearNoConfirm.body.code).not.toBe(200);

    const deleteBadConfirm = await request(app)
      .delete(`/api/v1/help/admin/slots/${badDoc}`)
      .set(auth())
      .query({ locale: badLocale, confirm: "wrong" });
    expect(deleteBadConfirm.body.code).not.toBe(200);

    const removed = await request(app)
      .delete(`/api/v1/help/admin/slots/${badDoc}`)
      .set(auth())
      .query({ locale: badLocale, confirm: badDoc })
      .expect(200);
    ok(removed.body);

    const localeRemoved = await request(app)
      .delete(`/api/v1/help/admin/locales/${badLocale}`)
      .set(auth())
      .query({ confirm: badLocale })
      .expect(200);
    ok(localeRemoved.body);

    const targetRemoved = await request(app)
      .delete(`/api/v1/help/admin/locales/${conflictTarget}`)
      .set(auth())
      .query({ confirm: conflictTarget })
      .expect(200);
    ok(targetRemoved.body);
  });
});
