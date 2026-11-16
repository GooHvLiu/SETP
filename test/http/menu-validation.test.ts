import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { Application } from "express";

import { getTestApp, loginAs } from "../helpers/http";

/** 菜单字段联动与回收站恢复冲突。 */
describe("菜单字段校验与恢复冲突", () => {
  let app: Application;
  let token = "";
  const suffix = Date.now().toString().slice(-8);

  beforeAll(async () => {
    app = await getTestApp();
    token = (await loginAs("superAdmin", "superAdmin123456@")).token;
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const notOk = (body: { code?: number }) => expect(body.code).not.toBe(200);

  it("路径与类型联动：站内格式、外链、权限空白与按钮字段", async () => {
    const base = { name: `fmt_${suffix}`, type: "DIR" };
    for (const path of [`relative-${suffix}`, `/fmt-${suffix}/`, `/fmt-${suffix}//x`, `/fmt-${suffix} x`]) {
      const res = await request(app)
        .post("/api/v1/menu")
        .set(auth())
        .send({ ...base, path });
      notOk(res.body);
    }

    const externalWithComponent = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name: `ext_${suffix}`, type: "MENU", path: "https://example.com/docs", permission: `qa:ext:${suffix}`, component: "qa/Ext" });
    notOk(externalWithComponent.body);

    const external = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name: `ext_ok_${suffix}`, type: "MENU", path: "https://example.com/ok", permission: `qa:extok:${suffix}` })
      .expect(200);
    expect(external.body.code).toBe(200);

    const spacedPermission = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name: `perm_${suffix}`, type: "DIR", path: `/perm-${suffix}`, permission: "qa:bad perm" });
    notOk(spacedPermission.body);

    const buttonBase = { parentId: external.body.data.id, type: "BUTTON" };
    for (const payload of [
      { ...buttonBase, name: `btn_path_${suffix}`, permission: `qa:bp:${suffix}`, path: "/x" },
      { ...buttonBase, name: `btn_comp_${suffix}`, permission: `qa:bc:${suffix}`, component: "qa/X" },
    ]) {
      const res = await request(app).post("/api/v1/menu").set(auth()).send(payload);
      notOk(res.body);
    }

    const buttonNoPermission = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ ...buttonBase, name: `btn_perm_${suffix}` });
    notOk(buttonNoPermission.body);

    const button = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ ...buttonBase, name: `btn_ok_${suffix}`, permission: `qa:bok:${suffix}` })
      .expect(200);

    const childOfButton = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name: `btn_child_${suffix}`, type: "DIR", path: `/btn-child-${suffix}`, parentId: button.body.data.id });
    notOk(childOfButton.body);

    const parentMissing = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name: `parent_missing_${suffix}`, type: "DIR", path: `/pm-${suffix}`, parentId: 99999999 });
    notOk(parentMissing.body);

    await request(app).delete(`/api/v1/menu/${button.body.data.id}`).set(auth()).expect(200);
    await request(app).delete(`/api/v1/menu/${external.body.data.id}`).set(auth()).expect(200);
  });

  it("缺失资源：更新、删除、恢复不存在的菜单均拒绝", async () => {
    const update = await request(app).put("/api/v1/menu/99999999").set(auth()).send({ name: "missing" });
    notOk(update.body);

    const remove = await request(app).delete("/api/v1/menu/99999999").set(auth());
    notOk(remove.body);

    const restore = await request(app).post("/api/v1/menu/99999999/restore").set(auth());
    notOk(restore.body);
  });

  it("回收站恢复：父节点未恢复、同级重名、权限码与路径冲突", async () => {
    const parentPath = `/restore-parent-${suffix}`;
    const parent = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name: `rp_${suffix}`, type: "DIR", path: parentPath })
      .expect(200);
    const child = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({
        parentId: parent.body.data.id,
        name: `rc_${suffix}`,
        type: "MENU",
        path: `${parentPath}/child`,
        component: "qa/Child",
        permission: `qa:rc:${suffix}`,
      })
      .expect(200);

    await request(app).delete(`/api/v1/menu/${child.body.data.id}`).set(auth()).expect(200);
    await request(app).delete(`/api/v1/menu/${parent.body.data.id}`).set(auth()).expect(200);

    const parentDeleted = await request(app).post(`/api/v1/menu/${child.body.data.id}/restore`).set(auth());
    notOk(parentDeleted.body);

    await request(app).post(`/api/v1/menu/${parent.body.data.id}/restore`).set(auth()).expect(200);
    await request(app).post(`/api/v1/menu/${child.body.data.id}/restore`).set(auth()).expect(200);
    await request(app).delete(`/api/v1/menu/${child.body.data.id}`).set(auth()).expect(200);
    await request(app).delete(`/api/v1/menu/${parent.body.data.id}`).set(auth()).expect(200);

    const name = `name_dup_${suffix}`;
    const first = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name, type: "DIR", path: `/nd-first-${suffix}` })
      .expect(200);
    await request(app).delete(`/api/v1/menu/${first.body.data.id}`).set(auth()).expect(200);
    const second = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name, type: "DIR", path: `/nd-second-${suffix}` })
      .expect(200);
    const nameConflict = await request(app).post(`/api/v1/menu/${first.body.data.id}/restore`).set(auth());
    notOk(nameConflict.body);

    const permission = `qa:dup:${suffix}`;
    const permFirst = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name: `perm_first_${suffix}`, type: "DIR", path: `/perm-first-${suffix}`, permission })
      .expect(200);
    await request(app).delete(`/api/v1/menu/${permFirst.body.data.id}`).set(auth()).expect(200);
    const permSecond = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name: `perm_second_${suffix}`, type: "DIR", path: `/perm-second-${suffix}`, permission })
      .expect(200);
    const permissionConflict = await request(app).post(`/api/v1/menu/${permFirst.body.data.id}/restore`).set(auth());
    notOk(permissionConflict.body);

    const path = `/path-dup-${suffix}`;
    const pathFirst = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name: `path_first_${suffix}`, type: "DIR", path })
      .expect(200);
    await request(app).delete(`/api/v1/menu/${pathFirst.body.data.id}`).set(auth()).expect(200);
    const pathSecond = await request(app)
      .post("/api/v1/menu")
      .set(auth())
      .send({ name: `path_second_${suffix}`, type: "DIR", path })
      .expect(200);
    const pathConflict = await request(app).post(`/api/v1/menu/${pathFirst.body.data.id}/restore`).set(auth());
    notOk(pathConflict.body);

    for (const id of [second.body.data.id, permSecond.body.data.id, pathSecond.body.data.id]) {
      await request(app).delete(`/api/v1/menu/${id}`).set(auth()).expect(200);
    }
  });
});
