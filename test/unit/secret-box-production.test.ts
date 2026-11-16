import { afterEach, describe, expect, it } from "vitest";

import env from "@src/config/env.schema";
import { openSecret, sealSecret } from "@src/utils/secretBox";

const original = { NODE_ENV: env.NODE_ENV, CONFIG_SECRET_KEY: env.CONFIG_SECRET_KEY };

/** 生产环境兜底：即使 schema 被绕过，也不能静默明文落库。 */
describe("secretBox 生产兜底", () => {
  afterEach(() => {
    (env as any).NODE_ENV = original.NODE_ENV;
    (env as any).CONFIG_SECRET_KEY = original.CONFIG_SECRET_KEY;
  });

  it("生产环境无密钥时加密直接失败", () => {
    (env as any).NODE_ENV = "production";
    (env as any).CONFIG_SECRET_KEY = undefined;
    expect(() => sealSecret("smtp-auth-code")).toThrow("CONFIG_SECRET_KEY_MISSING");
    expect(() => openSecret("enc:v1:aaaa:bbbb:cccc")).toThrow("CONFIG_SECRET_KEY_MISSING");
  });

  it("生产环境有密钥时仍可正常往返", () => {
    (env as any).NODE_ENV = "production";
    (env as any).CONFIG_SECRET_KEY = "k".repeat(40);
    expect(openSecret(sealSecret("secret-value"))).toBe("secret-value");
  });
});
