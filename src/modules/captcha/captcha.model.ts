/**
 * ============================================================
 * 验证码模块类型定义（modules/captcha/captcha.model.ts）
 * ============================================================
 */

/** 图形验证码返回 */
export interface CaptchaResultDto {
  captchaId: string; // 验证码 id（登录时回传）
  img: string; // SVG 图片内容
  expiresIn: number; // 过期时间（秒）
  devCode?: string; // 开发环境明文答案（生产环境不返回）
}
