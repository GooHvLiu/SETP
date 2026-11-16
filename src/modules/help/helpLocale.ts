/**
 * ============================================================
 * 帮助中心语言代码（modules/help/helpLocale.ts）
 * ------------------------------------------------------------
 * 统一规则：小写 + 连字符。
 * 前端 i18n 的 locale、data/help 下的目录名、system_configs.default_locale
 * 共用同一写法（zh-cn / en-us / ja-jp）。
 * ============================================================
 */

export const DEFAULT_HELP_LOCALE = "zh-cn";

/** 兼容 zh_CN / ZH-CN / zh-cn 等写法，统一落成 zh-cn */
export function normalizeLocale(value?: string | null): string {
  return (value || "").trim().replace(/_/g, "-").toLowerCase();
}

/** 把 locale 转成提示词里的语言名；未知语言回退原始代码 */
export function localeDisplayName(locale: string): string {
  try {
    const display = new Intl.DisplayNames([DEFAULT_HELP_LOCALE], {
      type: "language",
      languageDisplay: "standard",
    });
    return display.of(locale) || locale;
  } catch {
    return locale;
  }
}
