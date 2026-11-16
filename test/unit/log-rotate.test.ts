import { afterEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

import { createRotatingStream, getLogRotateState, type RotateOptions } from "../../src/utils/logRotate";

const dirs: string[] = [];
function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "setp-log-"));
  dirs.push(dir);
  return dir;
}

function options(dir: string, patch: Partial<RotateOptions> = {}): RotateOptions {
  return { dir, baseName: "app.log", maxSizeBytes: 16, maxFiles: 1, ...patch };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // 清理失败不影响断言
    }
  }
});

/** 日志轮转：按大小切分、历史保留份数与现状读取。 */
describe("日志文件轮转", () => {
  it("字符串写入触发轮转并保留指定历史份数", async () => {
    const dir = tempDir();
    const opts = options(dir);
    const stream = createRotatingStream(opts);
    stream.write("0123456789");
    stream.write("abcdefghij");
    stream.write("KLMNOPQRST");
    await new Promise<void>((resolve, reject) => {
      stream.end(() => resolve());
      stream.on("error", reject);
    });

    const current = path.join(dir, "app.log");
    expect(fs.existsSync(current)).toBe(true);
    const history = fs.readdirSync(dir).filter((name) => name.startsWith("app-") && name.endsWith(".log"));
    expect(history.length).toBeLessThanOrEqual(1);
    expect(getLogRotateState(opts).history).toBe(history.length);
    expect(getLogRotateState(opts).size).toBeGreaterThanOrEqual(0);
  });

  it("Buffer 写入与未创建目录的现状读取", async () => {
    const dir = path.join(tempDir(), "nested", "logs");
    const opts = options(dir, { maxSizeBytes: 1024, maxFiles: 3 });
    expect(getLogRotateState(opts).history).toBe(0);

    const stream = createRotatingStream(opts);
    stream.write(Buffer.from("buffer-line"));
    await new Promise<void>((resolve, reject) => {
      stream.end(() => resolve());
      stream.on("error", reject);
    });
    expect(getLogRotateState(opts).size).toBe(Buffer.byteLength("buffer-line"));
  });

  it("历史文件超出保留份数时按时间戳清理", async () => {
    const dir = tempDir();
    const opts = options(dir, { maxSizeBytes: 8, maxFiles: 0 });
    const stream = createRotatingStream(opts);
    stream.write("12345678");
    stream.write("abcdefgh");
    stream.write("ABCDEFGH");
    await new Promise<void>((resolve, reject) => {
      stream.end(() => resolve());
      stream.on("error", reject);
    });
    expect(fs.readdirSync(dir).filter((name) => name.startsWith("app-")).length).toBe(0);
  });
});
