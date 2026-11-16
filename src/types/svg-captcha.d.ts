/**
 * ============================================================
 * svg-captcha 类型声明（types/svg-captcha.d.ts）
 * ------------------------------------------------------------
 * svg-captcha 包没有自带 TS 类型，这里补一个最小声明
 * 注意：该包默认导出是内部函数 createCaptcha(text, options)，
 *       实际生成验证码必须用 create(options) / createMathExpr(options)
 * ============================================================
 */

declare module "svg-captcha" {
  interface CaptchaOptions {
    size?: number;
    ignoreChars?: string;
    noise?: number;
    width?: number;
    height?: number;
    color?: boolean;
    background?: string;
    fontSize?: number;
    charPreset?: string;
    mathMin?: number;
    mathMax?: number;
    mathOperator?: string;
  }

  interface CaptchaResult {
    data: string; // SVG 字符串
    text: string; // 验证码答案
  }

  /** 生成图形验证码（正确用法） */
  function create(options?: CaptchaOptions): CaptchaResult;
  /** 生成数学算式验证码 */
  function createMathExpr(options?: CaptchaOptions): CaptchaResult;
  /** 生成随机文本（不绘图） */
  function randomText(size?: number): string;
  /** 全局默认配置 */
  const options: CaptchaOptions;
  /** 加载自定义字体 */
  function loadFont(url: string): void;

  const svgCaptcha: {
    create: typeof create;
    createMathExpr: typeof createMathExpr;
    randomText: typeof randomText;
    options: CaptchaOptions;
    loadFont: typeof loadFont;
  };

  export default svgCaptcha;
  export = svgCaptcha;
}
