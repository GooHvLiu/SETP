import request from "supertest";
import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Application } from "express";

import { prisma } from "@src/db/prisma";
import { getTestApp, loginAs } from "../helpers/http";

/** 看板趋势：7 天契约、操作日志口径与权限边界。 */
describe("看板趋势接口", () => {
  let app: Application;
  let superToken = "";
  let noPermissionToken = "";
  let noPermissionUserId = 0;

  const marker = "dashboard-trend-test";
  const noPermissionUsername = "dashboardNoPermission";
  const noPermissionPassword = "Dashboard123456@";

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const localDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  beforeAll(async () => {
    app = await getTestApp();
    superToken = (await loginAs("superAdmin", "superAdmin123456@")).token;

    const noPermissionUser = await prisma.user.create({
      data: {
        username: noPermissionUsername,
        email: "dashboard-no-permission@example.com",
        passwordHash: await bcrypt.hash(noPermissionPassword, 10),
        realName: noPermissionUsername,
        status: 1,
      },
    });
    noPermissionUserId = noPermissionUser.id;
    noPermissionToken = (await loginAs(noPermissionUsername, noPermissionPassword)).token;
  });

  afterAll(async () => {
    await prisma.operationLog.deleteMany({ where: { module: marker } });
    if (noPermissionUserId) {
      await prisma.refreshToken.deleteMany({ where: { userId: noPermissionUserId } });
      await prisma.user.delete({ where: { id: noPermissionUserId } });
    }
  });

  it("固定返回 7 条、日期升序、最后一条是今天", async () => {
    const res = await request(app).get("/api/v1/dashboard/trend").set(auth(superToken)).expect(200);

    expect(res.body.code).toBe(200);
    expect(res.body.msg).toBe("SUCCESS");
    expect(Array.isArray(res.body.data.points)).toBe(true);

    const points = res.body.data.points as Array<{ date: string; count: number }>;
    expect(points).toHaveLength(7);
    expect(points.every((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date))).toBe(true);
    expect(points.every((point) => Number.isInteger(point.count) && point.count >= 0)).toBe(true);
    expect(points.map((point) => point.date)).toEqual([...points.map((point) => point.date)].sort());
    expect(points[points.length - 1].date).toBe(localDateKey(new Date()));

    const today = new Date();
    const first = new Date(today);
    first.setHours(0, 0, 0, 0);
    first.setDate(first.getDate() - 6);
    expect(points[0].date).toBe(localDateKey(first));
  });

  it("只统计 category=operation，新增登录日志不会增加今日计数", async () => {
    const before = await request(app).get("/api/v1/dashboard/trend").set(auth(superToken)).expect(200);
    const today = localDateKey(new Date());
    const beforeToday = before.body.data.points.find((point: { date: string }) => point.date === today).count as number;

    await prisma.operationLog.createMany({
      data: [
        {
          category: "operation",
          module: marker,
          action: "READ",
          result: "success",
          description: `${marker} operation`,
        },
        {
          category: "login",
          module: marker,
          action: "LOGIN",
          result: "success",
          description: `${marker} login`,
        },
      ],
    });

    const after = await request(app).get("/api/v1/dashboard/trend").set(auth(superToken)).expect(200);
    const afterToday = after.body.data.points.find((point: { date: string }) => point.date === today).count as number;

    expect(afterToday).toBe(beforeToday + 1);
  });

  it("没有 dashBoard:list 权限的账号返回 403", async () => {
    const res = await request(app).get("/api/v1/dashboard/trend").set(auth(noPermissionToken)).expect(403);

    expect(res.body.code).toBe(10104);
  });
});
