/**
 * ============================================================
 * 图形验证码服务（modules/captcha/captcha.service.ts）
 * ------------------------------------------------------------
 * 生成 SVG 验证码 + 内存缓存（uuid 绑定答案，2 分钟过期）
 * 一次性有效，校验通过后立即销毁
 * 注意：多实例部署时验证码建议换 Redis 存储（内存为单机方案）
 * ============================================================
 */

import svgCaptcha from "svg-captcha";
import { v4 as uuidv4 } from "uuid";

/** 验证码缓存项 */
interface CaptchaCacheItem {
  code: string;
  expire: number;
}

/** 内存存储：uuid -> 验证码答案 */
const captchaStore = new Map<string, CaptchaCacheItem>();

class CaptchaService {
  /**
   * 生成验证码
   * @returns { captchaId, img, expiresIn }
   */
  generateCaptcha() {
    // 注意：svg-captcha 正确用法是 svgCaptcha.create(options)，
    // 直接 svgCaptcha(options) 会把 options 当成 text 参数，返回空 data
    const cap = svgCaptcha.create({
      size: 4, // 4 位字符
      ignoreChars: "0o1iIl", // 排除易混淆字符
      noise: 3, // 3 条干扰线
      width: 120,
      height: 40,
    });

    const captchaId = uuidv4();
    captchaStore.set(captchaId, {
      code: cap.text.toLowerCase(),
      expire: Date.now() + 2 * 60 * 1000,
    });

    // 顺手清理过期验证码（防内存泄漏）
    for (const [key, val] of captchaStore.entries()) {
      if (val.expire < Date.now()) captchaStore.delete(key);
    }

    return {
      captchaId,
      img: cap.data, // SVG 字符串，前端直接赋值给 img src
      code: cap.text, // 明文答案（仅内部使用，由 controller 决定是否暴露）
      expiresIn: 120, // 有效期 120 秒
    };
  }

  /**
   * 校验验证码（一次性，校验通过立即销毁）
   */
  verifyCaptcha(code: string, captchaId: string): void {
    const cacheInfo = captchaStore.get(captchaId);

    if (!cacheInfo) {
      throw new Error("CAPTCHA_EXPIRED");
    }
    if (cacheInfo.code !== code.toLowerCase()) {
      throw new Error("CAPTCHA_ERROR");
    }

    captchaStore.delete(captchaId);
  }
}

export default new CaptchaService();
