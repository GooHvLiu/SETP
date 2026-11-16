import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { Application } from "express";

import { getTestApp, loginAs } from "../helpers/http";

/** 菜单：类型联动、路径格式、同级重名、父子删除与恢复保护。 */
describe("菜单负向与保护边界", () => {
  let app: Application;
  let token = "";
  const suffix = Date.now().toString().slice(-8);

  beforeAll(async () => {
    app = await getTestApp();
    token = (await loginAs("superAdmin", "superAdmin123456@")).token;
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const notOk = (body: { code?: number }) => expect(body.code).not.toBe(200);

  it("类型联动：DIR 缺 path、DIR 外链、MENU 缺组件、BUTTON 缺父级均拒绝", async () => {
    const dirNoPath = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name: `dir_${suffix}`, type: "DIR" });
    notOk(dirNoPath.body);

    const dirExternal = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name: `dir_ext_${suffix}`, type: "DIR", path: "https://example.com" });
    notOk(dirExternal.body);

    const menuNoComponent = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name: `menu_${suffix}`, type: "MENU", path: `/menu-${suffix}`, permission: `qa:menu:${suffix}` });
    notOk(menuNoComponent.body);

    const buttonNoParent = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name: `btn_${suffix}`, type: "BUTTON", permission: `qa:btn:${suffix}` });
    notOk(buttonNoParent.body);

    const badSlash = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name: `slash_${suffix}`, type: "DIR", path: `/slash-${suffix}//x` });
    notOk(badSlash.body);
  });

  it("同级重名与路径重复：第二次创建被拒绝", async () => {
    const name = `dup_${suffix}`;
    const path = `/dup-${suffix}`;
    const created = await request(app).post("/api/v1/menu").set(auth()).send({ name, type: "DIR", path }).expect(200);
    expect(created.body.code).toBe(200);
    const id = created.body.data.id as number;

    const duplicateName = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name, type: "DIR", path: `/dup2-${suffix}` });
    notOk(duplicateName.body);

    const duplicatePath = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name: `dup2_${suffix}`, type: "DIR", path });
    notOk(duplicatePath.body);

    await request(app).delete(`/api/v1/menu/${id}`).set(auth()).expect(200);
  });

  it("父子删除保护、恢复未删除菜单、父级指向自身", async () => {
    const parentPath = `/parent-${suffix}`;
    const parent = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name: `parent_${suffix}`, type: "DIR", path: parentPath })
      .expect(200);
    const parentId = parent.body.data.id as number;

    const child = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({
        parentId,
        name: `child_${suffix}`,
        type: "MENU",
        path: `${parentPath}/child`,
        component: "qa/Child",
        permission: `qa:child:${suffix}`,
      })
      .expect(200);
    const childId = child.body.data.id as number;

    const deleteParent = await request(app).delete(`/api/v1/menu/${parentId}`).set(auth());
    notOk(deleteParent.body);

    const selfParent = await request(app).put(`/api/v1/menu/${parentId}`).set(auth()).send({ parentId });
    notOk(selfParent.body);

    const restoreActive = await request(app).post(`/api/v1/menu/${parentId}/restore`).set(auth());
    notOk(restoreActive.body);

    await request(app).delete(`/api/v1/menu/${childId}`).set(auth()).expect(200);
    await request(app).delete(`/api/v1/menu/${parentId}`).set(auth()).expect(200);
  });
});
