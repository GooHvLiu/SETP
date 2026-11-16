import { describe, expect, it } from "vitest";
import request from "supertest";
import { getTestApp, loginAs } from "../helpers/http";

describe("RBAC 权限边界", () => {
  it("admin 可访问用户列表，但不能访问超管专属菜单清单", async () => {
    const app = await getTestApp();
    const admin = await loginAs("admin", "123456");

    const list = await request(app).get("/api/v1/user/list?page=1&pageSize=10").set("Authorization", `Bearer ${admin.token}`).expect(200);
    expect(list.body.code).toBe(200);
    expect(Array.isArray(list.body.data.list)).toBe(true);

    const menuList = await request(app).get("/api/v1/menu/list").set("Authorization", `Bearer ${admin.token}`).expect(403);
    expect(menuList.body.code).toBe(10104);
  });

  it("superAdmin 可访问超管专属菜单清单", async () => {
    const app = await getTestApp();
    const superAdmin = await loginAs("superAdmin", "superAdmin123456@");

    const menuList = await request(app).get("/api/v1/menu/list").set("Authorization", `Bearer ${superAdmin.token}`).expect(200);
    expect(menuList.body.code).toBe(200);
    expect(Array.isArray(menuList.body.data)).toBe(true);
  });
});
