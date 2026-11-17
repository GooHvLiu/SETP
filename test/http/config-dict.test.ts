import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { Application } from "express";

import { getTestApp, loginAs } from "../helpers/http";

/** 配置与字典：公开读取、域校验、批量校验、重复与不存在分支。 */
describe("配置与字典边界", () => {
  let app: Application;
  let token = "";
  const suffix = Date.now().toString().slice(-8);

  beforeAll(async () => {
    app = await getTestApp();
    token = (await loginAs("superAdmin", "superAdmin123456@")).token;
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("配置：匿名 public、登录 all、缺失 key、批量空数组", async () => {
    const publicConfig = await request(app).get("/api/v1/config/public").expect(200);
    expect(publicConfig.body.code).toBe(200);
    expect(Array.isArray(publicConfig.body.data)).toBe(true);

    const all = await request(app).get("/api/v1/config/all").set(auth()).expect(200);
    expect(all.body.code).toBe(200);
    expect(Array.isArray(all.body.data)).toBe(true);

    const missingKey = await request(app).put("/api/v1/config").set(auth()).send({ value: "x" });
    expect(missingKey.body.code).toBe(10003);

    const missingValue = await request(app).put("/api/v1/config").set(auth()).send({ key: "site_name" });
    expect(missingValue.body.code).toBe(10003);

    const unknownKey = await request(app).put("/api/v1/config").set(auth()).send({ key: "not_exist_key", value: "x" });
    expect(unknownKey.body.code).not.toBe(200);

    const emptyBatch = await request(app).post("/api/v1/super-admin/settings/batch").set(auth()).send({ items: [] });
    expect(emptyBatch.body.code).toBe(10003);

    const badBatch = await request(app)
      .post("/api/v1/super-admin/settings/batch")
      .set(auth())
      .send({ items: [{ key: "site_name" }] });
    expect(badBatch.body.code).toBe(10003);
  });

  it("配置：只读项不可通过常规接口改写", async () => {
    const all = await request(app).get("/api/v1/config/all").set(auth()).expect(200);
    const locked = all.body.data.find((item: { editable?: number }) => item.editable === 0);
    if (locked) {
      const res = await request(app).put("/api/v1/config").set(auth()).send({ key: locked.key, value: "x" });
      expect(res.body.code).not.toBe(200);
    }
  });

  it("配置：类型与范围校验拦截非法值", async () => {
    const cases: Array<{ key: string; value: string }> = [
      { key: "request_timeout", value: "abc" },
      { key: "request_timeout", value: "999" },
      { key: "request_timeout", value: "999999" },
      { key: "register_enabled", value: "yes" },
      { key: "help_mode", value: "unknown" },
      { key: "site_name", value: "x".repeat(101) },
    ];
    for (const item of cases) {
      const res = await request(app).put("/api/v1/config").set(auth()).send(item);
      expect(res.body.code).not.toBe(200);
    }

    const mixedBatch = await request(app)
      .post("/api/v1/super-admin/settings/batch")
      .set(auth())
      .send({
        items: [
          { key: "site_name", value: "QA 站点" },
          { key: "request_timeout", value: "abc" },
        ],
      });
    expect(mixedBatch.body.code).not.toBe(200);

    const validBatch = await request(app)
      .post("/api/v1/super-admin/settings/batch")
      .set(auth())
      .send({ items: [{ key: "site_name", value: "Setp" }] })
      .expect(200);
    expect(validBatch.body.code).toBe(200);
  });

  it("字典：重复类型、缺失字段、不存在类型与非法分页", async () => {
    const typeCode = `qa_type_${suffix}`;
    const created = await request(app).post("/api/v1/dict/type").set(auth()).send({ typeCode, typeName: "QA 字典" }).expect(200);
    expect(created.body.code).toBe(200);
    const typeId = created.body.data.id as number;

    const duplicate = await request(app).post("/api/v1/dict/type").set(auth()).send({ typeCode, typeName: "重复" });
    expect(duplicate.body.code).not.toBe(200);

    const missing = await request(app)
      .post("/api/v1/dict/type")
      .set(auth())
      .send({ typeCode: `qa_${suffix}` });
    expect(missing.body.code).toBe(10003);

    const badUpdate = await request(app).put("/api/v1/dict/type/99999999").set(auth()).send({ typeName: "不存在" });
    expect(badUpdate.body.code).not.toBe(200);

    const badDelete = await request(app).delete("/api/v1/dict/type/99999999").set(auth());
    expect(badDelete.body.code).not.toBe(200);

    const badData = await request(app).post("/api/v1/dict/data").set(auth()).send({ dictTypeId: 99999999, label: "x", value: "x" });
    expect(badData.body.code).not.toBe(200);

    const badPage = await request(app).get("/api/v1/dict/admin/types").set(auth()).query({ page: 0 });
    expect(badPage.body.code).toBe(10003);

    const missingTypeId = await request(app).get("/api/v1/dict/admin/data").set(auth()).query({ page: 1 });
    expect(missingTypeId.body.code).toBe(10003);

    await request(app).delete(`/api/v1/dict/type/${typeId}`).set(auth()).expect(200);
  });

  it("字典：类型与字典项增改删、重复值与缺失资源", async () => {
    const typeCode = `qa_full_${suffix}`;
    const created = await request(app)
      .post("/api/v1/dict/type")
      .set(auth())
      .send({ typeCode, typeName: "QA 完整字典", remark: "测试备注" })
      .expect(200);
    const typeId = created.body.data.id as number;

    const updatedType = await request(app)
      .put(`/api/v1/dict/type/${typeId}`)
      .set(auth())
      .send({ typeName: "QA 完整字典-改", status: 0 })
      .expect(200);
    expect(updatedType.body.code).toBe(200);

    const adminTypes = await request(app)
      .get("/api/v1/dict/admin/types")
      .set(auth())
      .query({ page: 1, pageSize: 10, keyword: typeCode, status: 0 })
      .expect(200);
    expect(adminTypes.body.code).toBe(200);
    expect(Array.isArray(adminTypes.body.data.list)).toBe(true);

    const item = await request(app)
      .post("/api/v1/dict/data")
      .set(auth())
      .send({ dictTypeId: typeId, label: "选项一", value: "one", sort: 2 })
      .expect(200);
    const itemId = item.body.data.id as number;

    const duplicateValue = await request(app)
      .post("/api/v1/dict/data")
      .set(auth())
      .send({ dictTypeId: typeId, label: "重复", value: "one" });
    expect(duplicateValue.body.code).not.toBe(200);

    const adminData = await request(app)
      .get("/api/v1/dict/admin/data")
      .set(auth())
      .query({ typeId, page: 1, pageSize: 10, keyword: "选项", status: 1 })
      .expect(200);
    expect(adminData.body.code).toBe(200);
    expect(Array.isArray(adminData.body.data.list)).toBe(true);

    const updatedItem = await request(app)
      .put(`/api/v1/dict/data/${itemId}`)
      .set(auth())
      .send({ label: "选项二", value: "two", sort: 5 })
      .expect(200);
    expect(updatedItem.body.code).toBe(200);

    const missingItem = await request(app).put("/api/v1/dict/data/99999999").set(auth()).send({ label: "x" });
    expect(missingItem.body.code).not.toBe(200);

    const deleteMissingItem = await request(app).delete("/api/v1/dict/data/99999999").set(auth());
    expect(deleteMissingItem.body.code).not.toBe(200);

    await request(app).delete(`/api/v1/dict/data/${itemId}`).set(auth()).expect(200);
    await request(app).delete(`/api/v1/dict/type/${typeId}`).set(auth()).expect(200);
    const deleteMissingType = await request(app).delete(`/api/v1/dict/type/${typeId}`).set(auth());
    expect(deleteMissingType.body.code).not.toBe(200);
  });
});
