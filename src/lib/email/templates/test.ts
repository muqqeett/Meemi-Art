import "server-only";

import {
  renderLayout,
  renderText,
  renderPanel,
  escapeHtml,
} from "@/lib/email/templates/layout";
import { emailConfig } from "@/lib/email/config";
import type { EmailMessage } from "@/lib/email/types";

/**
 * Deliverability check, sent only from admin settings.
 *
 * It restates the configuration it was sent with — sender, reply-to, site URL
 * — so the operator can confirm from the inbox that mail is leaving under the
 * right identity, rather than trusting the settings screen's own report of
 * itself. Seeing "Meemi Art <hello@meemiart.com>" in the From line *and* in the
 * body is what proves the environment is wired correctly.
 *
 * Contains no tokens, no links to authenticated pages and no secrets: a test
 * email is the one message most likely to be forwarded around a team.
 */
export function testEmailTemplate(args: { to: string; sentBy: string }): EmailMessage {
  const rows: [string, string][] = [
    ["From", emailConfig.from],
    ["Reply-To", emailConfig.replyTo || "(not set)"],
    ["Site", emailConfig.appUrl],
  ];

  const table = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:3px 12px 3px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6f6a75;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:3px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#15121a;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  return {
    to: args.to,
    subject: `${emailConfig.brand} — Test Email`,
    html: renderLayout({
      preheader: `Transactional email is working for ${emailConfig.brand}.`,
      heading: "Test email",
      body: `
        <p style="margin:0 0 14px;">
          If you are reading this, ${escapeHtml(emailConfig.brand)} can send transactional
          email. Verification links, password resets and order notifications will
          reach customers the same way.
        </p>
        ${renderPanel(`
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">${table}</table>
        `)}
        <p style="margin:0;font-size:13px;color:#6f6a75;">
          Requested from the admin settings page by ${escapeHtml(args.sentBy)}.
        </p>`,
    }),
    text: renderText("Test email", [
      `If you are reading this, ${emailConfig.brand} can send transactional email.`,
      "",
      ...rows.map(([label, value]) => `${label}: ${value}`),
      "",
      `Requested from the admin settings page by ${args.sentBy}.`,
    ]),
  };
}
