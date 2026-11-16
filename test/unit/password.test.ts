import { describe, expect, it } from "vitest";
import { checkPasswordStrength } from "../../src/utils/password";

/** 弱口令拦截：长度与字符类别两道门槛。 */
describe("checkPasswordStrength", () => {
  it("长度下限与上限分别拦截", () => {
    expect(checkPasswordStrength("Ab1!x").reason).toBe("PASSWORD_LENGTH");
    expect(checkPasswordStrength(`Ab1!${"x".repeat(29)}`).reason).toBe("PASSWORD_LENGTH");
  });

  it("字符类别不足三类时拦截", () => {
    expect(checkPasswordStrength("abcdefgh").reason).toBe("PASSWORD_CLASS");
    expect(checkPasswordStrength("abcdefg1").reason).toBe("PASSWORD_CLASS");
  });

  it("满足长度与三类字符时通过", () => {
    expect(checkPasswordStrength("Abcdef12")).toEqual({ valid: true });
    expect(checkPasswordStrength("Abcdef1!")).toEqual({ valid: true });
  });
});
