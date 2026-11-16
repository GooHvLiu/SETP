/**
 * ============================================================
 * 环境变量初始化中间件（middleware/dotenvInit.middleware.ts）
 * ------------------------------------------------------------
 * npm run init 时执行（dev 启动前自动运行）：
 *   1. 缺少 .env 时从 .env.example 生成
 *   2. 自动检测本机局域网 IP（IPv4，跳过回环）
 *   3. 写入 .env 文件的 LOCAL_IP 字段
 *   4. 确保 uploads / data 目录存在
 *
 * 用途：启动时把真实局域网 IP 写进 env，
 *       bootstrap 展示访问地址时直接读 LOCAL_IP，
 *       方便手机 / 局域网内其他设备联调（无需手改配置）。
 * ============================================================
 */

import fs from "fs";
import path from "path";
import os from "os";
import dotenv from "dotenv";

/** 首次运行时从示例文件生成 .env；已有 .env 不覆盖 */
function ensureEnvFile(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) return;

  const examplePath = path.resolve(process.cwd(), ".env.example");
  if (!fs.existsSync(examplePath)) {
    throw new Error("未找到 .env 与 .env.example，无法初始化环境变量");
  }

  fs.copyFileSync(examplePath, envPath);
  console.log("未找到 .env，已从 .env.example 生成；请检查 DATABASE_URL 等配置。");
}

/** 自动检测本机局域网 IP（跳过 IPv6 和回环，取第一个内网 IPv4） */
function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // 跳过 IPv6 和回环地址，取内网 IPv4
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

/** 确保必要目录存在（与 .env 的 UPLOAD_DIR / DATABASE_URL 对应） */
function ensureDirs(): void {
  const dirs = ["./uploads", "./data"];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Create Directory: ${dir}`);
    }
  }
}

/** 把检测到的 IP 写入 .env */
function updateLocalIP(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  const localIP = getLocalIP();

  // 读现有 .env
  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf8");
  }

  // 更新或追加 LOCAL_IP
  if (content.includes("LOCAL_IP=")) {
    content = content.replace(/LOCAL_IP=.*/g, `LOCAL_IP=${localIP}`);
  } else {
    content += `\nLOCAL_IP=${localIP}\n`;
  }

  fs.writeFileSync(envPath, content, "utf8");
  // 🌐 本机局域网 IP: ${localIP}（已写入 .env 的 LOCAL_IP）
  console.log(`🌐 Local IP: ${localIP}(Localized IP Written to. env)`);
}

// 执行初始化
ensureEnvFile();
ensureDirs();
updateLocalIP();
console.log("✅ Environment Variable Initialization Completed.");
