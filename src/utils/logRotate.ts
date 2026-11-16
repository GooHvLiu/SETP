/**
 * ============================================================
 * 日志文件轮转（utils/logRotate.ts）
 * ------------------------------------------------------------
 * 按大小轮转：当前 app.log 写入超过阈值后，重命名为
 * app-YYYYMMDD-HHMMSSmmm.log，随后新开同名空文件继续写。
 *   - 使用同步 fd 写入，轮转时先 close 再 rename，Windows 下不会锁文件
 *   - 历史文件只保留最近 N 份，超出部分按文件名（即时间戳）倒序清理
 *   - getLogRotateState 供健康检查读取当前大小与历史份数
 * ============================================================
 */

import fs from "fs";
import path from "path";
import { Writable } from "stream";

/** 轮转配置 */
export interface RotateOptions {
  /** 日志目录（绝对路径） */
  dir: string;
  /** 当前文件名，如 app.log */
  baseName: string;
  /** 单文件大小上限（字节） */
  maxSizeBytes: number;
  /** 历史文件保留份数（不含当前文件） */
  maxFiles: number;
}

/** 轮转现状（健康检查用） */
export interface RotateState {
  file: string;
  size: number;
  maxSizeBytes: number;
  maxFiles: number;
  history: number;
}

/** 左侧补零 */
function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

/** 轮转文件时间戳：YYYYMMDD-HHMMSSmmm */
function stamp(date: Date): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}${pad(date.getMilliseconds(), 3)}`;
  return `${day}-${time}`;
}

/** 历史文件命名规则：app-*.log */
function historyPattern(opts: RotateOptions): { prefix: string; suffix: string } {
  const suffix = path.extname(opts.baseName);
  const stem = path.basename(opts.baseName, suffix);
  return { prefix: `${stem}-`, suffix };
}

/** 按大小自动轮转的写入流 */
class RotatingFileStream extends Writable {
  private fd: number;
  private size: number;

  constructor(private readonly opts: RotateOptions) {
    super();
    fs.mkdirSync(opts.dir, { recursive: true });
    const file = path.join(opts.dir, opts.baseName);
    this.fd = fs.openSync(file, "a");
    this.size = fs.fstatSync(this.fd).size;
  }

  /** 容量不足时先轮转再写，避免单行把文件撑过上限后才切 */
  private rotateIfNeeded(nextBytes: number): void {
    if (this.size + nextBytes <= this.opts.maxSizeBytes) return;
    const file = path.join(this.opts.dir, this.opts.baseName);
    fs.closeSync(this.fd);
    const { prefix, suffix } = historyPattern(this.opts);
    fs.renameSync(file, path.join(this.opts.dir, `${prefix}${stamp(new Date())}${suffix}`));
    this.fd = fs.openSync(file, "a");
    this.size = 0;
    this.prune();
  }

  /** 清理超出保留份数的历史文件 */
  private prune(): void {
    const { prefix, suffix } = historyPattern(this.opts);
    const history = fs
      .readdirSync(this.opts.dir)
      .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
      .sort()
      .reverse();
    for (const name of history.slice(this.opts.maxFiles)) {
      try {
        fs.unlinkSync(path.join(this.opts.dir, name));
      } catch {
        // 清理失败不阻断写入，下一轮再试
      }
    }
  }

  _write(chunk: Buffer | string, encoding: BufferEncoding, callback: (err?: Error | null) => void): void {
    try {
      const bytes = typeof chunk === "string" ? Buffer.byteLength(chunk, encoding) : chunk.length;
      this.rotateIfNeeded(bytes);
      if (typeof chunk === "string") {
        fs.writeSync(this.fd, chunk, undefined, encoding);
      } else {
        fs.writeSync(this.fd, chunk);
      }
      this.size += bytes;
      callback();
    } catch (err) {
      callback(err as Error);
    }
  }

  _final(callback: (err?: Error | null) => void): void {
    try {
      fs.closeSync(this.fd);
      callback();
    } catch (err) {
      callback(err as Error);
    }
  }
}

/** 创建轮转写入流 */
export function createRotatingStream(opts: RotateOptions): Writable {
  return new RotatingFileStream(opts);
}

/** 读取日志轮转现状 */
export function getLogRotateState(opts: RotateOptions): RotateState {
  const file = path.join(opts.dir, opts.baseName);
  const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
  const { prefix, suffix } = historyPattern(opts);
  const history = fs.existsSync(opts.dir)
    ? fs.readdirSync(opts.dir).filter((name) => name.startsWith(prefix) && name.endsWith(suffix)).length
    : 0;
  return { file, size, maxSizeBytes: opts.maxSizeBytes, maxFiles: opts.maxFiles, history };
}
