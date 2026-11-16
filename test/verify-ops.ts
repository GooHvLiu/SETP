/**
 * ============================================================
 * 运维中心自检脚本（test/verify-ops.ts）
 * ------------------------------------------------------------
 * 用途：不依赖端口监听，直接验证四组运维能力的 service 层链路
 * 覆盖：
 *   1. 健康检查六项探测与整体状态
 *   2. 会话中心分页、状态过滤与汇总计数
 *   3. 运行指标区间结构
 *   4. 运维任务清单与危险任务标记
 *   5. 知识库文档分页
 *   6. 运维菜单权限码落库检查
 * 运行：npx tsx test/verify-ops.ts
 * ============================================================
 */

import menuService from "../src/modules/menu/menu.service";
import healthService from "../src/modules/health/health.service";
import sessionService from "../src/modules/session/session.service";
import metricsService from "../src/modules/metrics/metrics.service";
import opsTaskService from "../src/modules/opsTask/opsTask.service";
import helpService from "../src/modules/help/help.service";

let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, extra?: any): void {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}`, extra ?? "");
  }
}

async function main(): Promise<void> {
  // ---------- 1. 健康检查 ----------
  console.log("\n[1] 健康检查");
  const health = await healthService.run();
  check("整体状态合法（up / degraded / down）", ["up", "degraded", "down"].includes(health.status), health.status);
  const healthKeys = health.items.map((item) => item.key);
  check(
    "六项探测齐全",
    ["database", "memory", "disk", "logger", "helpIndex", "aiDependency"].every((key) => healthKeys.includes(key)),
    healthKeys.join(",")
  );
  check("database 探测非 fail", health.items.find((item) => item.key === "database")?.status !== "fail");
  const loggerItem = health.items.find((item) => item.key === "logger");
  check(
    "logger 项输出轮转上限信息",
    loggerItem?.messageKey === "health.logger.ok" && loggerItem?.params?.limitMB !== undefined,
    loggerItem?.messageKey
  );

  // ---------- 2. 会话中心 ----------
  console.log("\n[2] 会话中心");
  const sessions = await sessionService.list({ page: 1, pageSize: 10 });
  check("分页字段完整", typeof sessions.total === "number" && Array.isArray(sessions.list) && sessions.page === 1);
  const summary = sessions.summary as any;
  check(
    "汇总包含 active / expired / revoked",
    ["active", "expired", "revoked"].every((key) => typeof summary?.[key] === "number"),
    JSON.stringify(summary)
  );
  const activeOnly = await sessionService.list({ page: 1, pageSize: 10, status: "active" });
  check(
    "status=active 过滤生效",
    activeOnly.list.every((row) => row.status === "active")
  );

  // ---------- 3. 运行指标 ----------
  console.log("\n[3] 运行指标");
  const overview = metricsService.getOverview("1h");
  check("区间结构完整", !!overview.totals && !!overview.current && Array.isArray(overview.series));
  check("区间端点有序", overview.since <= overview.until);
  check("汇总字段完整", typeof overview.totals.requests === "number" && typeof overview.totals.errorRate === "number");
  if (overview.series.length >= 2) {
    const step = overview.series[1].ts - overview.series[0].ts;
    check("1h 区间分桶步长 60s", step === 60 * 1000, step);
  } else {
    console.log("  - 样本不足 2 点，跳过分桶步长检查");
  }

  // ---------- 4. 运维任务 ----------
  console.log("\n[4] 运维任务");
  const rawTasks: any = opsTaskService.list();
  const tasks: any[] = Array.isArray(rawTasks) ? rawTasks : (rawTasks?.list ?? []);
  check(
    "四项任务齐全",
    ["session-cleanup", "help-reindex", "db-backup", "db-reseed"].every((key) => tasks.some((task) => task.key === key)),
    tasks.map((task) => task.key).join(",")
  );
  const reseed = tasks.find((task) => task.key === "db-reseed");
  check("db-reseed 标记为危险任务", reseed?.danger === true && reseed?.group === "danger", JSON.stringify(reseed));

  // ---------- 5. 知识库文档 ----------
  console.log("\n[5] 知识库文档");
  const docs = await helpService.listDocs({ page: 1, pageSize: 5 });
  check("文档分页结构完整", typeof docs.total === "number" && Array.isArray(docs.list) && docs.page === 1);
  check("分页不越界", docs.list.length <= 5);

  // ---------- 6. 权限码落库 ----------
  console.log("\n[6] 运维权限码");
  const menuFlat = JSON.stringify(await menuService.getList());
  const requiredCodes = [
    "superAdmin:healthCheck:list",
    "superAdmin:health:probe",
    "superAdmin:sessionCenter:list",
    "superAdmin:session:revoke",
    "superAdmin:session:cleanup",
    "superAdmin:metricsCenter:list",
    "superAdmin:metrics:reset",
    "superAdmin:taskCenter:list",
    "superAdmin:task:run",
    "superAdmin:task:danger",
    "superAdmin:knowledgeCenter:list",
    "superAdmin:help:reindex",
  ];
  check(
    "运维权限码全部落库",
    requiredCodes.every((code) => menuFlat.includes(code))
  );

  console.log(`\n结果：通过 ${pass} 项，失败 ${fail} 项`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("FAILED", err);
  process.exit(1);
});
