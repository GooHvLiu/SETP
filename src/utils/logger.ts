/**
 * ============================================================
 * Pino 日志实例（utils/logger.ts）
 * ------------------------------------------------------------
 * 结构化 JSON 日志：
 *   - 控制台输出由 .env 的 LOG_CONSOLE 控制（true/false）
 *   - 文件输出：logs/app.log（JSON 行格式，对接 Loki / ELK）
 *   - 轮转：超过 LOG_MAX_SIZE_MB 自动切分为 app-时间戳.log，
 *     历史文件按 LOG_MAX_FILES 保留
 *
 * 用法：import logger from "@src/utils/logger";
 *       logger.info({ userId: 1 }, "用户创建成功");
 *       logger.error(err, "数据库连接失败");
 * ============================================================
 */

import pino from "pino";
import path from "path";
import env from "../config/env.schema";
import { createRotatingStream } from "./logRotate";

/** 日志目录 */
export const LOG_DIR = path.resolve(process.cwd(), "logs");
/** 单个日志文件大小上限（字节） */
export const LOG_MAX_SIZE_BYTES = env.LOG_MAX_SIZE_MB * 1024 * 1024;

/**
 * 组装输出目标：
 *   - 控制台（LOG_CONSOLE=true）：开发环境 pino-pretty 美化，生产环境原生 JSON
 *   - 文件（始终开启）：按大小轮转写入 logs/app.log
 */
type StreamList = Parameters<typeof pino.multistream>[0];

const streams: StreamList = [];

if (env.LOG_CONSOLE) {
  if (env.NODE_ENV !== "production") {
    streams.push({
      level: "debug",
      stream: pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname",
        },
      }),
    });
  } else {
    streams.push({ level: "info", stream: pino.destination(1) });
  }
}

streams.push({
  level: "info",
  stream: createRotatingStream({
    dir: LOG_DIR,
    baseName: "app.log",
    maxSizeBytes: LOG_MAX_SIZE_BYTES,
    maxFiles: env.LOG_MAX_FILES,
  }),
});

const logger = pino(
  {
    level: env.NODE_ENV === "production" ? "info" : "debug",
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
        "req.body.newPassword",
        "req.body.code",
        "password",
        "*.password",
        "token",
        "*.token",
      ],
      censor: "[REDACTED]",
    },
  },
  pino.multistream(streams)
);

export default logger;
