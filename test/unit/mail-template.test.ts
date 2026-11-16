import { describe, expect, it } from "vitest";

import {
  renderNotificationEmail,
  renderNotificationText,
  renderTestEmail,
  renderTestEmailText,
  renderVerificationCodeEmail,
  renderVerificationCodeText,
} from "@src/modules/mail/mail.template";

/** 邮件模板纯函数：转义、兜底文本、可选链接分支。 */
describe("邮件模板", () => {
  const base = { siteName: "SETP", recipient: "qa@test.com", testId: "T-1", messageId: "<m1@test>", sentAt: "2026-11-13" };

  it("测试邮件 HTML 与纯文本：转义用户可控字段", () => {
    const html = renderTestEmail(base);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("邮件服务已连接");
    expect(html).not.toContain("<m1@test>");

    const escaped = renderTestEmail({ ...base, recipient: `<script>alert("x")</script>` });
    expect(escaped).toContain("&lt;script&gt;");
    expect(escaped).not.toContain("<script>");

    const text = renderTestEmailText(base);
    expect(text).toContain("收件邮箱：qa@test.com");
    expect(text).toContain("测试编号：T-1");
  });

  it("验证码邮件：过滤非字母数字字符并截断到 8 位", () => {
    const html = renderVerificationCodeEmail({ siteName: "SETP", code: "12-34 56!78", expiresMinutes: 10 });
    expect(html).toContain("12345678");
    expect(html).not.toContain("12-34");

    const withRecipient = renderVerificationCodeEmail({
      siteName: "SETP",
      code: "123456",
      expiresMinutes: 10,
      purpose: "重置密码",
      recipient: "qa@test.com",
    });
    expect(withRecipient).toContain("重置密码");
    expect(withRecipient).toContain("qa@test.com");

    const text = renderVerificationCodeText({ siteName: "SETP", code: "123456", expiresMinutes: 10 });
    expect(text).toContain("验证码：123456");
    expect(text).toContain("10 分钟内有效");
  });

  it("通知邮件：合法链接生成按钮，非 http 链接不生成", () => {
    const withLink = renderNotificationEmail({
      siteName: "SETP",
      title: "账号被禁用",
      content: "第一行\n第二行",
      categoryLabel: "安全通知",
      link: "https://example.com/notice",
    });
    expect(withLink).toContain("查看详情");
    expect(withLink).toContain("第一行<br>第二行");

    const withoutLink = renderNotificationEmail({
      siteName: "SETP",
      title: "账号被禁用",
      content: "正文",
      categoryLabel: "安全通知",
      link: "javascript:alert(1)",
    });
    expect(withoutLink).not.toContain("查看详情");

    const text = renderNotificationText({ siteName: "SETP", title: "标题", content: "正文", categoryLabel: "安全通知", link: "" });
    expect(text).toContain("标题");
    expect(text).not.toContain("http");
  });
});
