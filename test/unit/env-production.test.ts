import { afterEach, describe, expect, it, vi } from "vitest";

const productionBase: Record<string, string> = {
  NODE_ENV: "production",
  DATABASE_URL: "file:./data/app.db",
  DB_TYPE: "sqlite",
  JWT_SECRET: "j".repeat(40),
  CONFIG_SECRET_KEY: "c".repeat(40),
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD: "AdminPass#2026",
  SUPER_ADMIN_PASSWORD: "SuperPass#2026",
  ADMIN_RESET_PASSWORD: "ResetPass#2026",
  CORS_ORIGINS: "https://admin.example.com",
};

async function loadEnv(overrides: Record<string, string | undefined> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries(productionBase)) vi.stubEnv(key, value);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else vi.stubEnv(key, value);
  }
  return import("@src/config/env.schema.ts");
}

/** 生产环境启动守卫：模板密钥、默认口令、空/通配 CORS 必须拒绝。 */
describe("生产环境配置守卫", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("CONFIG_SECRET_KEY 缺失或长度不足时拒绝启动", async () => {
    await expect(loadEnv({ CONFIG_SECRET_KEY: "short" })).rejects.toThrow(/CONFIG_SECRET_KEY/);
  });

  it("JWT_SECRET 仍是模板占位值时拒绝启动", async () => {
    await expect(loadEnv({ JWT_SECRET: "change-me-in-production-0123456789abcdef" })).rejects.toThrow(/JWT_SECRET/);
  });

  it("默认管理员口令未替换时拒绝启动", async () => {
    await expect(loadEnv({ ADMIN_PASSWORD: "123456" })).rejects.toThrow(/ADMIN_PASSWORD/);
  });

  it("CORS 为空或使用通配符时拒绝启动", async () => {
    await expect(loadEnv({ CORS_ORIGINS: " " })).rejects.toThrow(/CORS_ORIGINS/);
    await expect(loadEnv({ CORS_ORIGINS: "*" })).rejects.toThrow(/CORS_ORIGINS/);
  });

  it("生产环境显式替换全部模板值后通过", async () => {
    const mod = await loadEnv();
    expect(mod.env.NODE_ENV).toBe("production");
    expect(mod.env.CONFIG_SECRET_KEY).toBe("c".repeat(40));
  });
});
