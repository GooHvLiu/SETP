import { describe, expect, it } from "vitest";

import { openSecret, sealSecret } from "@src/utils/secretBox";

/** 敏感配置加解密：往返、幂等、历史明文、损坏密文。 */
describe("secretBox", () => {
  it("加密后可解密，重复加密保持密文", () => {
    const plain = "smtp-auth-code";
    const sealed = sealSecret(plain);
    expect(sealed.startsWith("enc:v1:")).toBe(true);
    expect(openSecret(sealed)).toBe(plain);
    expect(sealSecret(sealed)).toBe(sealed);
  });

  it("历史明文原样返回，空值不加密", () => {
    expect(openSecret("legacy-plain")).toBe("legacy-plain");
    expect(sealSecret("")).toBe("");
  });

  it("密文格式损坏抛出稳定错误", () => {
    expect(() => openSecret("enc:v1:only-one-part")).toThrow("CONFIG_VALUE_INVALID");
  });
});
