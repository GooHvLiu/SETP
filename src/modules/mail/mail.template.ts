/**
 * ============================================================
 * 邮件 HTML 模板（modules/mail/mail.template.ts）
 * ------------------------------------------------------------
 * 两套标准模板：
 *   1. renderTestEmail            —— 邮件服务测试（事务通知型）
 *   2. renderVerificationCodeEmail —— 验证码邮件（后续找回密码 / 二次验证）
 *
 * 说明：
 *   - 实际发送版使用 table + inline CSS，兼容 QQ 邮箱等客户端；
 *   - 视觉与「邮件服务测试模板」预览保持一致：深绿品牌头 + 薄荷状态区；
 *   - 不包含任何明文密码、授权码或重置 token。
 * ============================================================
 */

const FONT_STACK = `-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei','Helvetica Neue',Arial,sans-serif`;
const MONO_STACK = `ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace`;

const COLORS = {
  deep: "#0b3b36",
  teal: "#0f5c52",
  mint: "#e6f4f1",
  mintLine: "#cfe5df",
  ink: "#12211f",
  muted: "#5f716d",
  line: "#dfe7e4",
  paper: "#ffffff",
  soft: "#f2f8f6",
  footer: "#f6f8f7",
  warnBg: "#fbf7ed",
  warnLine: "#efe1c5",
  warnInk: "#6f5a32",
};

export interface TestEmailParams {
  siteName: string;
  recipient: string;
  testId: string;
  messageId: string;
  sentAt: string;
}

export interface VerificationCodeEmailParams {
  siteName: string;
  recipient?: string;
  code: string;
  expiresMinutes: number;
  purpose?: string;
}

/** HTML 文本转义 */
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 品牌缩写：取站点名前两个字符 */
function brandMark(siteName: string): string {
  const chars = Array.from(String(siteName ?? "").trim()).slice(0, 2);
  return escapeHtml(chars.join(""));
}

/** 公共外壳：品牌头 / 正文 / 页脚 */
function renderShell(options: { siteName: string; preheader: string; eyebrow: string; title: string; content: string }): string {
  const site = escapeHtml(options.siteName ?? "");
  const mark = brandMark(options.siteName);
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(options.title)}</title>
<style>
  @media only screen and (max-width:640px){
    .mail-wrap{padding:16px 8px !important}
    .mail-body{padding:28px 22px 26px !important}
    .mail-header{padding:22px 22px 20px !important}
    .mail-footer{padding:18px 22px 22px !important}
    .mail-title{font-size:25px !important}
    .mail-status-grid{display:block !important}
    .mail-status-item{padding:5px 0 !important}
    .mail-detail-label{width:40% !important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f1f5f4;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${options.preheader ? '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">' + escapeHtml(options.preheader) + "</div>" : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f1f5f4;margin:0;padding:0;">
    <tr>
      <td class="mail-wrap" align="center" style="padding:32px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:${COLORS.paper};border:1px solid #d9e3e0;border-radius:18px;overflow:hidden;">
          <tr>
            <td class="mail-header" style="background:${COLORS.deep};padding:26px 38px 24px;border-bottom:3px solid #b7e4d8;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="38" valign="middle" style="width:38px;">
                    <div style="width:38px;height:38px;border-radius:11px;background:${COLORS.mint};color:${COLORS.deep};font-family:${FONT_STACK};font-size:12px;font-weight:700;line-height:38px;text-align:center;letter-spacing:.04em;">${mark}</div>
                  </td>
                  <td valign="middle" style="padding-left:12px;">
                    <div style="font-family:${FONT_STACK};font-size:17px;font-weight:650;line-height:1.25;color:#f4fffc;letter-spacing:.02em;">${site}</div>
                    <div style="font-family:${FONT_STACK};font-size:10px;line-height:1.3;color:#a9cfc7;letter-spacing:.08em;margin-top:2px;">系统邮件</div>
                  </td>
                  <td valign="middle" align="right" style="font-family:${FONT_STACK};font-size:11px;line-height:1.3;color:#b7e4d8;letter-spacing:.04em;white-space:nowrap;">邮件服务</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="mail-body" style="padding:38px 42px 34px;">
              <div style="font-family:${FONT_STACK};font-size:12px;line-height:1.4;color:${COLORS.teal};letter-spacing:.02em;margin:0 0 14px;">
                <span style="display:inline-block;width:22px;height:1px;background:${COLORS.teal};vertical-align:middle;margin-right:8px;"></span>${escapeHtml(options.eyebrow)}
              </div>
              <h1 class="mail-title" style="margin:0 0 14px;font-family:${FONT_STACK};font-size:30px;line-height:1.3;font-weight:650;letter-spacing:-.025em;color:${COLORS.ink};">${escapeHtml(options.title)}</h1>
              ${options.content}
            </td>
          </tr>
          <tr>
            <td class="mail-footer" style="background:${COLORS.footer};border-top:1px solid #e2e9e7;padding:22px 42px 26px;">
              <div style="font-family:${FONT_STACK};font-size:13px;font-weight:650;line-height:1.4;color:${COLORS.ink};">${site} 系统邮件</div>
              <div style="font-family:${FONT_STACK};font-size:11px;line-height:1.8;color:${COLORS.muted};margin-top:4px;">此邮件由系统自动发送，请勿直接回复。如需帮助，请联系系统管理员。</div>
              <div style="font-family:${FONT_STACK};font-size:10px;line-height:1.6;color:#8a9995;margin-top:14px;padding-top:12px;border-top:1px solid #e4ebe9;">© ${year} ${site}. 保留所有权利。</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** 邮件服务测试模板 */
export function renderTestEmail(params: TestEmailParams): string {
  const recipient = escapeHtml(params.recipient);
  const testId = escapeHtml(params.testId);
  const messageId = escapeHtml(params.messageId);
  const sentAt = escapeHtml(params.sentAt);

  const content = `
    <p style="margin:0 0 24px;font-family:${FONT_STACK};font-size:15px;line-height:1.85;color:${COLORS.muted};">
      这是一封测试邮件。你能看到它，说明邮件发送链路已经打通，后续的密码重置和通知邮件可以复用这套服务。
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${COLORS.soft};border:1px solid ${COLORS.mintLine};border-radius:14px;margin:0 0 28px;">
      <tr>
        <td style="padding:18px 20px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="28" valign="top" style="width:28px;">
                <div style="width:26px;height:26px;border-radius:50%;background:${COLORS.teal};color:#fff;font-family:${FONT_STACK};font-size:13px;font-weight:700;line-height:26px;text-align:center;">&#10003;</div>
              </td>
              <td style="padding-left:12px;">
                <div style="font-family:${FONT_STACK};font-size:16px;font-weight:650;line-height:1.4;color:${COLORS.ink};">测试通过</div>
                <div style="font-family:${FONT_STACK};font-size:13px;line-height:1.7;color:${COLORS.muted};margin-top:3px;">SMTP 已接受这封邮件，并且已在收件箱中确认收到。</div>
              </td>
            </tr>
          </table>
          <div style="height:1px;background:#d7e9e4;margin:16px 0 14px;"></div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="50%" valign="top" style="font-family:${FONT_STACK};font-size:11px;color:${COLORS.muted};">SMTP 发送</td>
              <td width="50%" valign="top" align="right" style="font-family:${FONT_STACK};font-size:12px;font-weight:650;color:${COLORS.teal};white-space:nowrap;">已接受</td>
            </tr>
            <tr>
              <td width="50%" valign="top" style="font-family:${FONT_STACK};font-size:11px;color:${COLORS.muted};padding-top:10px;">收件确认</td>
              <td width="50%" valign="top" align="right" style="font-family:${FONT_STACK};font-size:12px;font-weight:650;color:${COLORS.teal};white-space:nowrap;padding-top:10px;">已收到</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="font-family:${FONT_STACK};font-size:12px;font-weight:650;line-height:1.4;color:${COLORS.ink};margin:0 0 6px;">测试详情</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      <tr><td style="border-top:0;padding:11px 0;font-family:${FONT_STACK};font-size:12px;color:${COLORS.muted};width:36%;">收件邮箱</td><td style="border-top:0;padding:11px 0;font-family:${FONT_STACK};font-size:12px;color:${COLORS.ink};word-break:break-word;">${recipient}</td></tr>
      <tr><td style="border-top:1px solid ${COLORS.line};padding:11px 0;font-family:${FONT_STACK};font-size:12px;color:${COLORS.muted};width:36%;">测试编号</td><td style="border-top:1px solid ${COLORS.line};padding:11px 0;font-family:${MONO_STACK};font-size:11px;color:#344743;word-break:break-word;">${testId}</td></tr>
      <tr><td style="border-top:1px solid ${COLORS.line};padding:11px 0;font-family:${FONT_STACK};font-size:12px;color:${COLORS.muted};width:36%;">发送时间</td><td style="border-top:1px solid ${COLORS.line};padding:11px 0;font-family:${FONT_STACK};font-size:12px;color:${COLORS.ink};">${sentAt}</td></tr>
      <tr><td style="border-top:1px solid ${COLORS.line};padding:11px 0;font-family:${FONT_STACK};font-size:12px;color:${COLORS.muted};width:36%;">消息 ID</td><td style="border-top:1px solid ${COLORS.line};padding:11px 0;font-family:${MONO_STACK};font-size:11px;color:#344743;word-break:break-word;">${messageId}</td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${COLORS.warnBg};border:1px solid ${COLORS.warnLine};border-radius:12px;">
      <tr><td style="padding:13px 15px;font-family:${FONT_STACK};font-size:12px;line-height:1.75;color:${COLORS.warnInk};">
        如果这不是你发起的测试，可以忽略此邮件。若收件箱没有看到它，请先检查垃圾邮件文件夹。
      </td></tr>
    </table>`;

  return renderShell({
    siteName: params.siteName,
    preheader: "邮件服务测试已通过",
    eyebrow: "邮件服务测试",
    title: "邮件服务已连接",
    content,
  });
}

/** 邮件服务测试纯文本版（不支持 HTML 的客户端兜底） */
export function renderTestEmailText(params: TestEmailParams): string {
  return [
    `${params.siteName} 邮件服务测试`,
    "",
    "邮件服务已连接：SMTP 已接受，收件箱已确认收到。",
    `收件邮箱：${params.recipient}`,
    `测试编号：${params.testId}`,
    `发送时间：${params.sentAt}`,
    `消息 ID：${params.messageId}`,
    "",
    "如果这不是你发起的测试，可以忽略此邮件。",
  ].join("\n");
}

/** 验证码邮件模板 */
export function renderVerificationCodeEmail(params: VerificationCodeEmailParams): string {
  const purpose = escapeHtml(params.purpose || "验证身份");
  const recipient = params.recipient ? escapeHtml(params.recipient) : "";
  const code = String(params.code ?? "")
    .replace(/[^0-9A-Za-z]/g, "")
    .slice(0, 8);
  const content = `
    <p style="margin:0 0 24px;font-family:${FONT_STACK};font-size:15px;line-height:1.85;color:${COLORS.muted};">
      你正在进行${purpose}，请在页面输入下面的验证码完成操作。
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${COLORS.soft};border:1px solid ${COLORS.mintLine};border-radius:14px;margin:0 0 22px;">
      <tr>
        <td align="center" style="padding:24px 12px 20px;">
          <div style="font-family:${FONT_STACK};font-size:11px;line-height:1.4;color:${COLORS.muted};letter-spacing:.08em;margin-bottom:12px;">验证码</div>
          <div style="font-family:${MONO_STACK};font-size:32px;font-weight:700;line-height:1.35;letter-spacing:6px;color:${COLORS.deep};word-break:break-all;">${escapeHtml(code)}</div>
          <div style="font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${COLORS.muted};margin-top:14px;">${params.expiresMinutes} 分钟内有效</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${COLORS.warnBg};border:1px solid ${COLORS.warnLine};border-radius:12px;margin:0 0 18px;">
      <tr><td style="padding:13px 15px;font-family:${FONT_STACK};font-size:12px;line-height:1.75;color:${COLORS.warnInk};">
        验证码只用于本次操作，请勿转发给他人。如果这不是你本人的操作，请忽略此邮件并联系系统管理员。
      </td></tr>
    </table>

    ${recipient ? `<div style="font-family:${FONT_STACK};font-size:11px;line-height:1.7;color:#8a9995;">此验证码发送至：${recipient}</div>` : ""}`;

  return renderShell({
    siteName: params.siteName,
    preheader: "",
    eyebrow: "身份验证",
    title: "你的验证码",
    content,
  });
}

/** 验证码邮件纯文本版 */
export function renderVerificationCodeText(params: VerificationCodeEmailParams): string {
  const purpose = params.purpose || "验证身份";
  return [
    `${params.siteName} ${purpose}验证码`,
    "",
    `验证码：${params.code}`,
    `${params.expiresMinutes} 分钟内有效。`,
    "",
    "验证码只用于本次操作，请勿转发给他人。如果这不是你本人的操作，请忽略此邮件并联系系统管理员。",
  ].join("\n");
}

/** 通知邮件参数（站内通知同步发信） */
export interface NotificationEmailParams {
  siteName: string;
  title: string;
  content: string;
  categoryLabel: string;
  link?: string;
}

/** 通知邮件：复用同一套品牌外壳，分类只作为眉标与状态色 */
export function renderNotificationEmail(params: NotificationEmailParams): string {
  const title = escapeHtml(params.title);
  const body = escapeHtml(params.content).replace(/\r?\n/g, "<br>");
  const link = String(params.link || "").trim();
  const linkHtml = /^https?:\/\//i.test(link)
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;">
      <tr><td style="background:${COLORS.teal};border-radius:10px;">
        <a href="${escapeHtml(link)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;font-family:${FONT_STACK};font-size:14px;font-weight:650;line-height:1.2;color:#ffffff;text-decoration:none;">查看详情</a>
      </td></tr>
    </table>`
    : "";

  const content = `
    <div style="font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${COLORS.muted};letter-spacing:.06em;margin:0 0 10px;">${escapeHtml(params.categoryLabel)}</div>
    <div style="font-family:${FONT_STACK};font-size:24px;font-weight:700;line-height:1.35;color:${COLORS.ink};margin:0 0 18px;">${title}</div>
    <div style="font-family:${FONT_STACK};font-size:15px;line-height:1.85;color:#314340;margin:0;">${body}</div>
    ${linkHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${COLORS.soft};border:1px solid ${COLORS.mintLine};border-radius:12px;margin:24px 0 0;">
      <tr><td style="padding:13px 15px;font-family:${FONT_STACK};font-size:12px;line-height:1.75;color:${COLORS.muted};">
        这是一封系统通知邮件，请勿直接回复。如需处理，请登录系统查看站内通知。
      </td></tr>
    </table>`;

  return renderShell({
    siteName: params.siteName,
    preheader: params.title,
    eyebrow: params.categoryLabel,
    title: params.title,
    content,
  });
}

/** 通知邮件纯文本版 */
export function renderNotificationText(params: NotificationEmailParams): string {
  const link = String(params.link || "").trim();
  return [
    `${params.siteName} ${params.categoryLabel}`,
    "",
    params.title,
    "",
    params.content,
    ...(link ? ["", link] : []),
    "",
    "这是一封系统通知邮件，请勿直接回复。",
  ].join("\n");
}
