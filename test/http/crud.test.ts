import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { Application } from "express";

import { getTestApp, loginAs } from "../helpers/http";

/**
 * 写操作闭环：创建 → 更新 → 删除。
 * 这些用例补齐 modules.test.ts 只覆盖 GET 的空洞，数据全部使用时间戳后缀并在用例内清理。
 */
describe("CRUD 写操作闭环", () => {
  let app: Application;
  let token = "";
  const suffix = Date.now().toString().slice(-8);

  beforeAll(async () => {
    app = await getTestApp();
    const session = await loginAs("superAdmin", "superAdmin123456@");
    token = session.token;
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const ok = (body: { code?: number }) => expect(body.code).toBe(200);

  it("用户：创建、更新、重置密码、批量删除", async () => {
    const username = `qa_${suffix}`;
    const created = await request(app)
      .post("/api/v1/user")
      .set(auth())
      .send({ username, password: "Qa@123456", email: `${username}@test.com`, realName: "QA 用户" })
      .expect(200);
    ok(created.body);
    const userId = created.body.data.id as number;
    expect(userId).toBeGreaterThan(0);

    const updated = await request(app).put(`/api/v1/user/${userId}`).set(auth()).send({ realName: "QA 用户-改" }).expect(200);
    ok(updated.body);

    const detail = await request(app).get(`/api/v1/user/${userId}`).set(auth()).expect(200);
    ok(detail.body);
    expect(detail.body.data.realName).toBe("QA 用户-改");

    const reset = await request(app).post(`/api/v1/user/${userId}/reset-password`).set(auth()).expect(200);
    ok(reset.body);

    const removed = await request(app)
      .post("/api/v1/user/batch-delete")
      .set(auth())
      .send({ ids: [userId] })
      .expect(200);
    ok(removed.body);
  });

  it("角色：创建、更新、分配菜单/权限、删除", async () => {
    const code = `qa${suffix}`;
    const created = await request(app)
      .post("/api/v1/role")
      .set(auth())
      .send({ code, name: "QA 角色", description: "自动化测试", status: 1, menuIds: [1] })
      .expect(200);
    ok(created.body);
    const roleId = created.body.data.id as number;
    expect(roleId).toBeGreaterThan(0);

    const updated = await request(app).put(`/api/v1/role/${roleId}`).set(auth()).send({ name: "QA 角色-改", status: 0 }).expect(200);
    ok(updated.body);

    const assignMenus = await request(app)
      .put(`/api/v1/role/${roleId}/menus`)
      .set(auth())
      .send({ menuIds: [1, 2] })
      .expect(200);
    ok(assignMenus.body);

    const assignPerms = await request(app)
      .put(`/api/v1/role/${roleId}/permissions`)
      .set(auth())
      .send({ permissionCodes: ["adminCenter:user:list"] })
      .expect(200);
    ok(assignPerms.body);

    const removed = await request(app).delete(`/api/v1/role/${roleId}`).set(auth()).expect(200);
    ok(removed.body);
  });

  it("字典：类型与字典项的完整生命周期", async () => {
    const typeCode = `qa_${suffix}`;
    const typeCreated = await request(app)
      .post("/api/v1/dict/type")
      .set(auth())
      .send({ typeCode, typeName: "QA 字典", remark: "自动化测试" })
      .expect(200);
    ok(typeCreated.body);
    const typeId = typeCreated.body.data.id as number;

    const dataCreated = await request(app)
      .post("/api/v1/dict/data")
      .set(auth())
      .send({ dictTypeId: typeId, label: "选项一", value: "one", sort: 1 })
      .expect(200);
    ok(dataCreated.body);
    const dataId = dataCreated.body.data.id as number;

    const typeUpdated = await request(app).put(`/api/v1/dict/type/${typeId}`).set(auth()).send({ typeName: "QA 字典-改" }).expect(200);
    ok(typeUpdated.body);

    const dataUpdated = await request(app).put(`/api/v1/dict/data/${dataId}`).set(auth()).send({ label: "选项一改", sort: 2 }).expect(200);
    ok(dataUpdated.body);

    const dataRemoved = await request(app).delete(`/api/v1/dict/data/${dataId}`).set(auth()).expect(200);
    ok(dataRemoved.body);

    const typeRemoved = await request(app).delete(`/api/v1/dict/type/${typeId}`).set(auth()).expect(200);
    ok(typeRemoved.body);
  });

  it("通知：发送、读取、全部已读", async () => {
    const sent = await request(app)
      .post("/api/v1/notification/admin/send")
      .set(auth())
      .send({
        title: `QA 通知 ${suffix}`,
        content: "自动化测试通知内容",
        category: "announcement",
        type: "info",
        audience: { type: "all" },
        sendEmail: false,
      })
      .expect(200);
    ok(sent.body);

    const list = await request(app).get("/api/v1/notification/list").set(auth()).expect(200);
    ok(list.body);

    const readAll = await request(app).post("/api/v1/notification/read-all").set(auth()).expect(200);
    ok(readAll.body);
  });

  it("菜单：创建、更新、删除、回收站、恢复", async () => {
    const created = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({
        parentId: 0,
        name: `QA 菜单 ${suffix}`,
        type: "MENU",
        path: `/qa-menu-${suffix}`,
        component: "qa/index",
        permission: `qa:menu:${suffix}`,
        sort: 999,
        status: 1,
        visible: 0,
      })
      .expect(200);
    ok(created.body);
    const menuId = created.body.data.id as number;

    const updated = await request(app)
      .put(`/api/v1/menu/${menuId}`)
      .set(auth())
      .send({ name: `QA 菜单改 ${suffix}`, sort: 998 })
      .expect(200);
    ok(updated.body);

    const removed = await request(app).delete(`/api/v1/menu/${menuId}`).set(auth()).expect(200);
    ok(removed.body);

    const deleted = await request(app).get("/api/v1/menu/deleted").set(auth()).expect(200);
    ok(deleted.body);
    expect((deleted.body.data as Array<{ id: number }>).some((item) => item.id === menuId)).toBe(true);

    const restored = await request(app).post(`/api/v1/menu/${menuId}/restore`).set(auth()).expect(200);
    ok(restored.body);

    const cleaned = await request(app).delete(`/api/v1/menu/${menuId}`).set(auth()).expect(200);
    ok(cleaned.body);
  });

  it("配置：读取可编辑系统参数并原值回写", async () => {
    const all = await request(app).get("/api/v1/config/all").set(auth()).expect(200);
    ok(all.body);
    const editable = (
      all.body.data as Array<{
        configKey: string;
        configValue: string;
        editable: number;
        configScope: string;
        sensitive: boolean;
      }>
    ).find((item) => item.editable === 1 && item.configScope === "system" && !item.sensitive);
    expect(editable).toBeTruthy();

    const updated = await request(app)
      .put("/api/v1/config")
      .set(auth())
      .send({ key: editable!.configKey, value: editable!.configValue })
      .expect(200);
    ok(updated.body);
  });
});
