import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

import {
  assertLocale,
  contentTypeOfFile,
  filePrefixTitle,
  findManifestDoc,
  flattenManifest,
  listLocaleDirs,
  manifestPath,
  normalizeRelPath,
  parseFrontmatter,
  parsePrefix,
  readManifest,
  readManifestOrThrow,
  resolveDocPath,
  resolveDocFile,
  scanLocaleFiles,
  validateManifest,
  writeManifest,
} from "../../src/modules/help/help.manifest";
import { normalizeLocale, localeDisplayName } from "../../src/modules/help/helpLocale";

/** 帮助中心 manifest 纯函数：语言、路径、frontmatter 与文档树遍历。 */
describe("帮助中心 manifest", () => {
  const manifest = {
    schemaVersion: 1,
    locale: "zh-cn",
    title: "帮助中心",
    tree: [
      {
        key: "guide",
        title: "指南",
        type: "section",
        sort: 10,
        children: [
          {
            key: "ch1",
            title: "第一章",
            type: "chapter",
            sort: 1,
            children: [
              { key: "child", title: "子文档", type: "doc", sort: 2, file: "guide/child.pdf", contentType: "pdf" },
              { key: "intro", title: "简介", type: "doc", sort: 3, file: "guide/intro.md", contentType: "md" },
            ],
          },
        ],
      },
    ],
  } as any;

  it("语言代码归一与非法值拒绝", () => {
    expect(normalizeLocale(" ZH_CN ")).toBe("zh-cn");
    expect(normalizeLocale(null)).toBe("");
    expect(assertLocale("zh_CN")).toBe("zh-cn");
    expect(() => assertLocale("")).toThrow("HELP_LOCALE_NOT_FOUND");
    expect(() => assertLocale("zh_CN_extra_segments")).toThrow("HELP_LOCALE_NOT_FOUND");
    expect(localeDisplayName("zh-cn").length).toBeGreaterThan(0);
    expect(localeDisplayName("not-a-locale")).toBeTruthy();
  });

  it("相对路径归一与路径穿越拦截", () => {
    expect(normalizeRelPath("guide\\intro.md")).toBe("guide/intro.md");
    expect(() => normalizeRelPath("../secret.md")).toThrow();
    expect(() => normalizeRelPath("/etc/passwd")).toThrow();
    expect(() => normalizeRelPath("\\guide\\intro.md")).toThrow();
  });

  it("frontmatter：带标题摘要、仅正文、空标题回退", () => {
    const parsed = parseFrontmatter("---\ntitle: 快速开始\nsummary: 五分钟上手\n---\n正文");
    expect(parsed.title).toBe("快速开始");
    expect(parsed.summary).toBe("五分钟上手");
    expect(parsed.body).toContain("正文");
    expect(parseFrontmatter("正文").body).toBe("正文");
    expect(parseFrontmatter("---\ntitle: \n---\n正文").body).toContain("正文");
  });

  it("文件前缀与类型推断", () => {
    expect(parsePrefix("01-intro")).toEqual({ sort: 1, title: "intro" });
    expect(parsePrefix("intro").sort).toBe(0);
    expect(filePrefixTitle("02-guide.md")).toBe("guide.md");
    expect(contentTypeOfFile("a.pdf")).toBe("pdf");
    expect(contentTypeOfFile("a.md")).toBe("md");
    expect(() => contentTypeOfFile("a.txt")).toThrow();
  });

  it("文档树展开、查找与路径解析", () => {
    expect(flattenManifest(manifest)).toHaveLength(2);
    expect(findManifestDoc(manifest, "intro")?.doc.title).toBe("简介");
    expect(findManifestDoc(manifest, "not-exist")).toBeNull();
    expect(resolveDocPath({ key: "intro", path: "custom/path" } as any)).toBe("custom/path");
    expect(resolveDocPath({ key: "intro", file: "guide/intro.md" } as any)).toBe("guide/intro");
    expect(resolveDocFile("zh-cn", "guide/intro.md").replace(/\\/g, "/")).toContain("guide/intro.md");
  });

  it("manifest 结构校验：合法、语言不匹配与缺失字段", () => {
    const valid = validateManifest(manifest, "zh-cn");
    expect(valid.tree).toHaveLength(1);
    expect(() => validateManifest(manifest, "en-us")).toThrow();
    expect(() => validateManifest({ locale: "zh-cn", tree: [] }, "zh-cn")).toThrow();
    expect(() => validateManifest(null, "zh-cn")).toThrow();
  });

  it("读取语言目录：写入后可回读、缺失时抛出与空目录扫描", () => {
    const locale = `qa-${Date.now().toString().slice(-8)}`;
    const dir = path.join(process.cwd(), "data", "help", locale);
    try {
      writeManifest({ ...manifest, locale });
      expect(readManifest(locale)?.locale).toBe(locale);
      expect(manifestPath(locale).replace(/\\/g, "/")).toContain(`${locale}/help.manifest.json`);
      expect(scanLocaleFiles(locale)).toEqual([]);
      expect(listLocaleDirs().some((item) => item.locale === locale)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }

    const absent = "qa-00000000";
    expect(readManifest(absent)).toBeNull();
    expect(() => readManifestOrThrow(absent)).toThrow("HELP_LOCALE_NOT_FOUND");
    expect(scanLocaleFiles(absent)).toEqual([]);
  });
});
