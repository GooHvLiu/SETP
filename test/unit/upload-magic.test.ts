import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { validateFiles } from "@src/middleware/upload.middleware";

const tmpDir = path.resolve(process.cwd(), ".tmp-upload-test");

function makeFile(name: string, content: Buffer, mimetype = "image/png"): Express.Multer.File {
  fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content);
  return {
    fieldname: "file",
    originalname: name,
    encoding: "7bit",
    mimetype,
    size: content.length,
    destination: tmpDir,
    filename: name,
    path: filePath,
    buffer: content,
    stream: null as never,
  };
}

/** 上传文件头校验：合法图片/PDF 通过，伪装类型与未知类型拒绝。 */
describe("upload magic number", () => {
  afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  it("允许 JPEG / PNG / GIF / PDF 文件头", () => {
    expect(() => validateFiles([makeFile("a.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))])).not.toThrow();
    expect(() => validateFiles([makeFile("a.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")])).not.toThrow();
    expect(() => validateFiles([makeFile("a.gif", Buffer.from("GIF89a"), "image/gif")])).not.toThrow();
    expect(() => validateFiles([makeFile("a.pdf", Buffer.from("%PDF-1.7"), "application/pdf")])).not.toThrow();
  });

  it("拒绝伪装成图片的文本、未知类型与空文件头", () => {
    expect(() => validateFiles([makeFile("fake.png", Buffer.from("not-a-png"))])).toThrow("FILE_TYPE_NOT_ALLOWED");
    expect(() => validateFiles([makeFile("a.bin", Buffer.from("bin"), "application/octet-stream")])).toThrow("FILE_TYPE_NOT_ALLOWED");
    expect(() => validateFiles([makeFile("empty.png", Buffer.alloc(0))])).toThrow("FILE_TYPE_NOT_ALLOWED");
  });

  it("拒绝已落盘但文件丢失的记录", () => {
    const file = makeFile("missing.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    fs.unlinkSync(file.path);
    expect(() => validateFiles([file])).toThrow("FILE_TYPE_NOT_ALLOWED");
  });
});
