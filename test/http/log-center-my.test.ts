import request from "supertest";
import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Application } from "express";

import { prisma } from "@src/db/prisma";
import { ROLE } from "@src/constants/role";
import { getTestApp, loginAs } from "../helpers/http";

/** 个人日志：范围隔离、通知邮件口径、分页与筛选回归。 */
describe("日志中心 - 个人日志", () => {
  let app: Application;
  let adminToken = "";
  let operatorToken = "";
  let viewerToken = "";

  const marker = "my-log-scope-test";
  const testUserIds: number[] = [];
  let operatorUser: { id: number; username: string; email: string };
  let viewerUser: { id: number; username: string; email: string };

  const password = "LogScope123456@";

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function createUser(username: string, email: string, roleCode: string) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) throw new Error(`role not found: ${roleCode}`);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        realName: username,
        status: 1,
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    testUserIds.push(user.id);
    return user;
  }

  beforeAll(async () => {
    app = await getTestApp();
    adminToken = (await loginAs("admin", "123456")).token;

    operatorUser = await createUser("logScopeOperator", "logscope-operator@example.com", ROLE.OPERATOR);
    viewerUser = await createUser("logScopeViewer", "logscope-viewer@example.com", ROLE.VIEWER);
    const otherUser = await createUser("logScopeOther", "logscope-other@example.com", ROLE.VIEWER);

    operatorToken = (await loginAs(operatorUser.username, password)).token;
    viewerToken = (await loginAs(viewerUser.username, password)).token;

    const adminUser = await prisma.user.findUnique({ where: { username: "admin" }, select: { id: true, email: true } });
    if (!adminUser) throw new Error("seed admin missing");

    // 操作日志：当前用户 3 条用于分页；其他账号各 1 条用于范围隔离
    for (const action of ["CREATE", "UPDATE", "DELETE"]) {
      await prisma.operationLog.create({
        data: {
          userId: operatorUser.id,
          username: operatorUser.username,
          category: "operation",
          module: marker,
          action,
          result: "success",
          description: `${marker} self ${action}`,
        },
      });
    }
    await prisma.operationLog.create({
      data: {
        userId: viewerUser.id,
        username: viewerUser.username,
        category: "operation",
        module: marker,
        action: "READ",
        result: "success",
        description: `${marker} viewer`,
      },
    });
    await prisma.operationLog.create({
      data: {
        userId: otherUser.id,
        username: otherUser.username,
        category: "operation",
        module: marker,
        action: "READ",
        result: "success",
        description: `${marker} other`,
      },
    });
    await prisma.operationLog.create({
      data: {
        userId: adminUser.id,
        username: "admin",
        category: "operation",
        module: marker,
        action: "READ",
        result: "success",
        description: `${marker} admin`,
      },
    });

    // 登录失败流水：userId 为空，只能由用户名精确归属
    await prisma.operationLog.create({
      data: {
        userId: null,
        username: operatorUser.username,
        category: "login",
        module: marker,
        action: "LOGIN",
        result: "failed",
        reason: "LOGIN_FAILED",
        description: `${marker} login self`,
      },
    });
    await prisma.operationLog.create({
      data: {
        userId: null,
        username: otherUser.username,
        category: "login",
        module: marker,
        action: "LOGIN",
        result: "failed",
        reason: "LOGIN_FAILED",
        description: `${marker} login other`,
      },
    });

    // 通知邮件：用户 ID 收件 + 邮箱兜底；测试邮件/验证码不得进入个人日志
    await prisma.mailLog.create({
      data: {
        userId: operatorUser.id,
        toEmail: operatorUser.email,
        subject: `${marker} notify self`,
        template: "notify_system",
        status: "sent",
      },
    });
    await prisma.mailLog.create({
      data: {
        userId: null,
        toEmail: operatorUser.email,
        subject: `${marker} notify self fallback`,
        template: "notify_security",
        status: "failed",
      },
    });
    await prisma.mailLog.create({
      data: {
        userId: otherUser.id,
        toEmail: otherUser.email,
        subject: `${marker} notify other`,
        template: "notify_business",
        status: "sent",
      },
    });
    await prisma.mailLog.create({
      data: {
        userId: operatorUser.id,
        toEmail: otherUser.email,
        subject: `${marker} test mail to other`,
        template: "mail_test",
        status: "sent",
      },
    });
    await prisma.mailLog.create({
      data: {
        userId: operatorUser.id,
        toEmail: operatorUser.email,
        subject: `${marker} verification code`,
        template: "verification_code",
        status: "sent",
      },
    });
    await prisma.mailLog.create({
      data: {
        userId: adminUser.id,
        toEmail: "leak-target@example.com",
        subject: `${marker} admin test leak`,
        template: "mail_test",
        status: "sent",
      },
    });
  });

  afterAll(async () => {
    await prisma.mailLog.deleteMany({ where: { subject: { contains: marker } } });
    await prisma.operationLog.deleteMany({ where: { OR: [{ module: marker }, { userId: { in: testUserIds } }] } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: testUserIds } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: testUserIds } } });
    for (const userId of testUserIds) {
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  it("admin 只返回自己的记录", async () => {
    const res = await request(app)
      .get("/api/v1/log-center/my-list")
      .set(auth(adminToken))
      .query({ category: "operation", module: marker, pageSize: 100 })
      .expect(200);

    expect(res.body.code).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.list).toHaveLength(1);
    expect(res.body.data.list[0].username).toBe("admin");
    expect(res.body.data.list.every((row: any) => row.username === "admin")).toBe(true);
  });

  it("operator / viewer 有 dataSearch:list 权限，不返回 403", async () => {
    const operator = await request(app)
      .get("/api/v1/log-center/my-list")
      .set(auth(operatorToken))
      .query({ category: "operation", module: marker, pageSize: 100 })
      .expect(200);
    expect(operator.body.data.total).toBe(3);
    expect(operator.body.data.list.every((row: any) => row.username === operatorUser.username)).toBe(true);

    const viewer = await request(app)
      .get("/api/v1/log-center/my-list")
      .set(auth(viewerToken))
      .query({ category: "operation", module: marker, pageSize: 100 })
      .expect(200);
    expect(viewer.body.data.total).toBe(1);
    expect(viewer.body.data.list[0].username).toBe(viewerUser.username);
  });

  it("传入 username 不影响个人范围", async () => {
    const res = await request(app)
      .get("/api/v1/log-center/my-list")
      .set(auth(operatorToken))
      .query({ category: "operation", module: marker, username: "logScopeOther", pageSize: 100 })
      .expect(200);

    expect(res.body.code).toBe(200);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.list.every((row: any) => row.username === operatorUser.username)).toBe(true);
  });

  it("mail 仅返回发给当前用户的通知邮件", async () => {
    const res = await request(app)
      .get("/api/v1/log-center/my-list")
      .set(auth(operatorToken))
      .query({ category: "mail", keyword: marker, pageSize: 100 })
      .expect(200);

    expect(res.body.code).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.list).toHaveLength(2);
    expect(res.body.data.list.every((row: any) => row.template.startsWith("notify_"))).toBe(true);
    expect(res.body.data.list.every((row: any) => row.toEmail === operatorUser.email)).toBe(true);
    expect(res.body.data.list.some((row: any) => row.template === "mail_test")).toBe(false);
    expect(res.body.data.list.some((row: any) => row.template === "verification_code")).toBe(false);
  });

  it("mail_test 不会带出非当前用户邮箱", async () => {
    const res = await request(app)
      .get("/api/v1/log-center/my-list")
      .set(auth(adminToken))
      .query({ category: "mail", keyword: marker, pageSize: 100 })
      .expect(200);

    expect(res.body.code).toBe(200);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.list).toHaveLength(0);
  });

  it("分页 total 使用个人范围命中数，keyword / 时间 / 结果筛选不被范围覆盖", async () => {
    const page2 = await request(app)
      .get("/api/v1/log-center/my-list")
      .set(auth(operatorToken))
      .query({ category: "operation", module: marker, page: 2, pageSize: 2 })
      .expect(200);
    expect(page2.body.data.total).toBe(3);
    expect(page2.body.data.list).toHaveLength(1);

    const filtered = await request(app)
      .get("/api/v1/log-center/my-list")
      .set(auth(operatorToken))
      .query({
        category: "login",
        module: marker,
        keyword: "login self",
        result: "failed",
        from: "2020-01-01",
        to: "2030-01-01",
      })
      .expect(200);
    expect(filtered.body.data.total).toBe(1);
    expect(filtered.body.data.list).toHaveLength(1);
    expect(filtered.body.data.list[0].username).toBe(operatorUser.username);
  });

  it("原 /list 仍返回非超管全量，行为不变", async () => {
    const res = await request(app)
      .get("/api/v1/log-center/list")
      .set(auth(adminToken))
      .query({ category: "operation", module: marker, pageSize: 100 })
      .expect(200);

    expect(res.body.code).toBe(200);
    expect(res.body.data.total).toBeGreaterThan(1);
    expect(res.body.data.list.some((row: any) => row.username === "logScopeOther")).toBe(true);
  });
});
