import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ensureDir, resolvePath, safeUnlink } from "@src/utils/file";

/** 文件工具：目录创建、路径规范化、安全删除。 */
describe("file utils", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it("ensureDir 递归创建且幂等", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setp-file-"));
    roots.push(root);
    const nested = path.join(root, "a", "b");
    ensureDir(nested);
    ensureDir(nested);
    expect(fs.existsSync(nested)).toBe(true);
    expect(fs.statSync(nested).isDirectory()).toBe(true);
  });

  it("safeUnlink 删除文件，不存在时不抛错", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setp-file-"));
    roots.push(root);
    const file = path.join(root, "tmp.txt");
    fs.writeFileSync(file, "x");
    safeUnlink(file);
    expect(fs.existsSync(file)).toBe(false);
    expect(() => safeUnlink(file)).not.toThrow();
  });

  it("resolvePath 返回绝对路径", () => {
    expect(path.isAbsolute(resolvePath("data", "app.db"))).toBe(true);
  });
});
