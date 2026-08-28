import "server-only";

import { emailConfig, emailUrl } from "@/lib/email/config";
import { siteConfig } from "@/lib/config";

/**
 * Shared transactional email shell.
 *
 * Built as nested tables with inline styles because that is what survives
 * Outlook, Gmail's clipping and Apple Mail alike — no external stylesheet, no
 * flexbox, no web fonts. Colours mirror the storefront tokens.
 */

const PURPLE = "#24113f";
const DEEP = "#321a5f";
const BLUE = "#3157c8";
const LAVENDER = "#f0ecfa";
const PAPER = "#faf9fc";
const INK = "#15121a";
const MUTED = "#6f6a75";
const BORDER = "#e3daf5";

/** Escapes user-supplied text before it goes anywhere near the HTML body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailButton = { label: string; url: string };

export function renderButton(button: EmailButton): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
    <tr>
      <td align="center" bgcolor="${PURPLE}" style="border-radius:2px;">
        <a href="${escapeHtml(button.url)}"
           style="display:inline-block;padding:14px 30px;font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#ffffff;text-decoration:none;border-radius:2px;">
          ${escapeHtml(button.label)}
        </a>
      </td>
    </tr>
  </table>`;
}

/** A bordered panel used for order summaries and security notices. */
export function renderPanel(inner: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="margin:24px 0;border:1px solid ${BORDER};border-radius:2px;background-color:${PAPER};">
    <tr><td style="padding:18px 20px;">${inner}</td></tr>
  </table>`;
}

export function renderLayout(options: {
  /** Short summary shown in the inbox preview line. */
  preheader: string;
  heading: string;
  body: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(options.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${LAVENDER};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:${LAVENDER};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background-color:#ffffff;border-radius:3px;overflow:hidden;">

          <tr>
            <td align="center" bgcolor="${PURPLE}" style="padding:26px 24px;">
              <a href="${escapeHtml(emailUrl("/"))}"
                 style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;letter-spacing:0.5px;color:#ffffff;text-decoration:none;">
                ${escapeHtml(emailConfig.brand)}
              </a>
              <div style="margin-top:5px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c7b6e8;">
                Handmade Crochet
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:34px 32px 12px;">
              <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:1.25;font-weight:700;color:${PURPLE};">
                ${escapeHtml(options.heading)}
              </h1>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:${INK};">
                ${options.body}
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 30px;">
              <div style="height:1px;background-color:${BORDER};margin-bottom:18px;"></div>
              <p style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:${MUTED};">
                Questions? Reply to this email or write to
                <a href="mailto:${escapeHtml(emailConfig.replyToAddress || siteConfig.email)}"
                   style="color:${BLUE};text-decoration:none;">${escapeHtml(emailConfig.replyToAddress || siteConfig.email)}</a>.
              </p>
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.7;color:${MUTED};">
                <a href="${escapeHtml(emailUrl("/privacy"))}" style="color:${DEEP};text-decoration:underline;">Privacy</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(emailUrl("/terms"))}" style="color:${DEEP};text-decoration:underline;">Terms</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(emailUrl("/refunds"))}" style="color:${DEEP};text-decoration:underline;">Refunds</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(emailUrl("/contact"))}" style="color:${DEEP};text-decoration:underline;">Contact</a>
              </p>
              <p style="margin:12px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:${MUTED};">
                © ${new Date().getFullYear()} ${escapeHtml(emailConfig.brand)}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Wraps a plain-text body with the same header and footer information. */
export function renderText(heading: string, lines: string[]): string {
  return [
    emailConfig.brand.toUpperCase(),
    "Handmade Crochet",
    "",
    heading,
    "",
    ...lines,
    "",
    "---",
    `Questions? ${emailConfig.replyToAddress || siteConfig.email}`,
    `© ${new Date().getFullYear()} ${emailConfig.brand}`,
  ].join("\n");
}
