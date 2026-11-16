import { describe, expect, it } from "vitest";

import {
  CONFIG_REGISTRY,
  getConfigDefinition,
  getEnvFallback,
  listDefinitions,
  parseConfigValidation,
  resolveConfigValue,
  validateConfigValue,
  type ConfigDefinition,
} from "../../src/config/config.registry";

/** 注册表纯函数：取值优先级、校验规则合并与各类型写入校验。 */
describe("系统参数注册表", () => {
  const base = (patch: Partial<ConfigDefinition>): ConfigDefinition => ({
    key: "qa_key",
    scope: "system",
    group: "general",
    readScope: "all",
    type: "string",
    defaultValue: "default",
    validation: {},
    description: "qa",
    ...patch,
  });

  it("按 key 取定义并按域筛选", () => {
    expect(getConfigDefinition("site_name")?.scope).toBe("super");
    expect(getConfigDefinition("not-exist-key")).toBeUndefined();
    expect(listDefinitions()).toHaveLength(CONFIG_REGISTRY.length);
    expect(listDefinitions("system").every((item) => item.scope === "system")).toBe(true);
    expect(listDefinitions("super").every((item) => item.scope === "super")).toBe(true);
  });

  it("取值优先级：DB > env > 默认值", () => {
    const def = base({ envKey: "APP_PORT", envTransform: (raw) => String(Number(raw) * 1000) });
    expect(resolveConfigValue(def, "db-value")).toEqual({ value: "db-value", source: "db" });
    expect(resolveConfigValue(def, null).source).toBe("env");
    expect(resolveConfigValue(base({}), undefined)).toEqual({ value: "default", source: "default" });
  });

  it("密文损坏或密钥轮换后单条回退，不影响其他参数", () => {
    const def = base({ envKey: "APP_PORT" });
    const fallback = resolveConfigValue(def, "enc:v1:broken:broken:broken");
    expect(fallback.source).toBe("env");
    expect(fallback.value).toBe(String(Number(process.env.APP_PORT || 3000)));
    expect(resolveConfigValue(def, "plain-value")).toEqual({ value: "plain-value", source: "db" });
  });

  it("env 兜底：无 envKey、未配置、正常换算与换算异常", () => {
    expect(getEnvFallback(base({}))).toBeNull();
    expect(getEnvFallback(base({ envKey: "QA_NOT_EXIST_ENV" }))).toBeNull();
    expect(getEnvFallback(base({ envKey: "APP_PORT" }))).toBe(String(Number(process.env.APP_PORT || 3000)));
    expect(
      getEnvFallback(
        base({
          envKey: "APP_PORT",
          envTransform: () => {
            throw new Error("boom");
          },
        })
      )
    ).toBe(String(process.env.APP_PORT || 3000));
  });

  it("validation_json 合并与脏数据回退", () => {
    const def = base({ validation: { min: 1, max: 10 } });
    expect(parseConfigValidation(def, null)).toEqual({ min: 1, max: 10 });
    expect(parseConfigValidation(def, '{"max":20}')).toEqual({ min: 1, max: 20 });
    expect(parseConfigValidation(def, "not-json")).toEqual({ min: 1, max: 10 });
    expect(parseConfigValidation(def, "123")).toEqual({ min: 1, max: 10 });
  });

  it("number：非数字、小数、越界与合法值", () => {
    const def = base({ type: "number", validation: { min: 1, max: 100, integer: true } });
    expect(() => validateConfigValue(def, "abc")).toThrow("CONFIG_VALUE_INVALID");
    expect(() => validateConfigValue(def, "1.5")).toThrow("CONFIG_VALUE_INVALID");
    expect(() => validateConfigValue(def, "0")).toThrow("CONFIG_VALUE_INVALID");
    expect(() => validateConfigValue(def, "101")).toThrow("CONFIG_VALUE_INVALID");
    expect(() => validateConfigValue(def, "50")).not.toThrow();
    expect(() => validateConfigValue(def, "1.5", '{"integer":false}')).not.toThrow();
  });

  it("boolean / enum / json 三分支", () => {
    const boolDef = base({ type: "boolean" });
    expect(() => validateConfigValue(boolDef, "true")).not.toThrow();
    expect(() => validateConfigValue(boolDef, "0")).not.toThrow();
    expect(() => validateConfigValue(boolDef, "yes")).toThrow("CONFIG_VALUE_INVALID");

    const enumDef = base({ type: "enum" });
    expect(() => validateConfigValue(enumDef, "static")).toThrow("CONFIG_VALUE_INVALID");
    expect(() => validateConfigValue(enumDef, "static", '{"options":["static","ai"]}')).not.toThrow();
    expect(() => validateConfigValue(enumDef, "other", '{"options":["static","ai"]}')).toThrow("CONFIG_VALUE_INVALID");

    const jsonDef = base({ type: "json" });
    expect(() => validateConfigValue(jsonDef, "{bad}")).toThrow("CONFIG_VALUE_INVALID");
    expect(() => validateConfigValue(jsonDef, '{"ok":1}')).not.toThrow();
  });

  it("string：maxLength 与 email / url / date 格式", () => {
    const lengthDef = base({ validation: { maxLength: 5 } });
    expect(() => validateConfigValue(lengthDef, "12345")).not.toThrow();
    expect(() => validateConfigValue(lengthDef, "123456")).toThrow("CONFIG_VALUE_INVALID");

    const emailDef = base({ validation: { format: "email" } });
    expect(() => validateConfigValue(emailDef, "a@b.com")).not.toThrow();
    expect(() => validateConfigValue(emailDef, "not-email")).toThrow("CONFIG_VALUE_INVALID");

    const urlDef = base({ validation: { format: "url" } });
    expect(() => validateConfigValue(urlDef, "https://example.com")).not.toThrow();
    expect(() => validateConfigValue(urlDef, "ftp://example.com")).toThrow("CONFIG_VALUE_INVALID");

    const dateDef = base({ validation: { format: "date" } });
    expect(() => validateConfigValue(dateDef, "2026-01-01")).not.toThrow();
    expect(() => validateConfigValue(dateDef, "2026/01/01")).toThrow("CONFIG_VALUE_INVALID");
  });
});
