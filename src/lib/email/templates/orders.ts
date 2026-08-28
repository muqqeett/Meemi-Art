import "server-only";

import {
  renderLayout,
  renderText,
  renderButton,
  renderPanel,
  escapeHtml,
} from "@/lib/email/templates/layout";
import { emailConfig, emailUrl } from "@/lib/email/config";
import { formatMoney } from "@/lib/money";
import type { EmailMessage } from "@/lib/email/types";

export type OrderEmailLine = {
  name: string;
  quantity: number;
  totalCents: number;
  imageUrl: string | null;
};

export type OrderEmailData = {
  orderNumber: string;
  email: string;
  customerName: string;
  placedAt: Date;
  lines: OrderEmailLine[];
  subtotalCents: number;
  discountCents: number;
  couponCode: string | null;
  totalCents: number;
  currency: string;
};

function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || "there";
}

/** Line items as a table. No thumbnails — many clients block remote images. */
function renderLines(lines: OrderEmailLine[]): string {
  const rows = lines
    .map(
      (line) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e3daf5;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#17131c;">
          <strong>${escapeHtml(line.name)}</strong><br>
          <span style="font-size:12px;color:#6f6878;">Qty ${line.quantity}</span>
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #e3daf5;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#17131c;white-space:nowrap;">
          ${formatMoney(line.totalCents)}
        </td>
      </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
}

/**
 * Totals.
 *
 * No shipping line and no tax line. Nothing is posted, and Paddle is the
 * merchant of record — any sales tax it collected is stated on Paddle's own
 * receipt, not ours. Printing a tax figure here would claim we collected
 * money we never touched.
 */
function renderTotals(data: OrderEmailData): string {
  const row = (label: string, value: string, bold = false) => `
    <tr>
      <td style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;font-size:${bold ? "15px" : "13px"};color:${bold ? "#24113f" : "#6f6878"};${bold ? "font-weight:700;" : ""}">${escapeHtml(label)}</td>
      <td align="right" style="padding:5px 0;font-family:Helvetica,Arial,sans-serif;font-size:${bold ? "15px" : "13px"};color:${bold ? "#24113f" : "#17131c"};${bold ? "font-weight:700;" : ""}white-space:nowrap;">${escapeHtml(value)}</td>
    </tr>`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
    ${row("Subtotal", formatMoney(data.subtotalCents))}
    ${data.discountCents > 0 ? row(`Discount${data.couponCode ? ` (${data.couponCode})` : ""}`, `−${formatMoney(data.discountCents)}`) : ""}
    <tr><td colspan="2" style="padding-top:8px;border-top:1px solid #e3daf5;"></td></tr>
    ${row(`Total paid (${data.currency})`, formatMoney(data.totalCents), true)}
  </table>`;
}

function linesText(lines: OrderEmailLine[]): string[] {
  return lines.map(
    (line) => `  ${line.name} × ${line.quantity} — ${formatMoney(line.totalCents)}`,
  );
}

/**
 * Sent once payment has been verified by webhook — never before.
 *
 * The call to action points at the customer's own downloads page, not at a
 * file. A signed storage URL in an email would outlive the message, survive
 * forwarding, and work for anyone who received it; the account page re-checks
 * authorisation on every click.
 */
export function purchaseReadyTemplate(data: OrderEmailData): EmailMessage {
  const downloadsUrl = emailUrl("/account/downloads");
  const orderUrl = emailUrl(`/orders/${encodeURIComponent(data.orderNumber)}`);
  const placed = data.placedAt.toLocaleDateString("en-US", { dateStyle: "long" });

  return {
    to: data.email,
    subject: `Your ${emailConfig.brand} purchase is ready`,
    html: renderLayout({
      preheader: `Order ${data.orderNumber} is paid and ready to download.`,
      heading: "Your purchase is ready",
      body: `
        <p style="margin:0 0 16px;">Hi ${escapeHtml(firstName(data.customerName))},</p>
        <p style="margin:0 0 16px;">
          Payment for order <strong>${escapeHtml(data.orderNumber)}</strong> has been
          confirmed. Your files are available in your account now.
        </p>
        ${renderButton({ label: "Download your purchase", url: downloadsUrl })}
        ${renderPanel(`
          <p style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:#6f6878;">
            Order ${escapeHtml(data.orderNumber)} · ${escapeHtml(placed)}
          </p>
          ${renderLines(data.lines)}
          ${renderTotals(data)}
        `)}
        <p style="margin:16px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6f6878;">
          Your downloads stay available in your account — you can come back to them
          any time. <a href="${escapeHtml(orderUrl)}" style="color:#3157c8;">View this order</a>.
        </p>`,
    }),
    text: renderText(`Your ${emailConfig.brand} purchase is ready`, [
      `Hi ${firstName(data.customerName)},`,
      "",
      `Payment for order ${data.orderNumber} has been confirmed. Your files are ready.`,
      "",
      `Download: ${downloadsUrl}`,
      "",
      `Order ${data.orderNumber} — ${placed}`,
      ...linesText(data.lines),
      "",
      `Subtotal: ${formatMoney(data.subtotalCents)}`,
      ...(data.discountCents > 0
        ? [`Discount${data.couponCode ? ` (${data.couponCode})` : ""}: −${formatMoney(data.discountCents)}`]
        : []),
      `Total paid (${data.currency}): ${formatMoney(data.totalCents)}`,
      "",
      `View this order: ${orderUrl}`,
    ]),
  };
}

/** Internal notification. Goes to the shop's own mailbox, never to a customer. */
export function adminNewOrderTemplate(data: OrderEmailData): EmailMessage {
  const adminUrl = emailUrl(`/admin/orders/${encodeURIComponent(data.orderNumber)}`);

  return {
    to: emailConfig.adminEmail,
    subject: `New paid order ${data.orderNumber} — ${formatMoney(data.totalCents)}`,
    html: renderLayout({
      preheader: `${data.customerName} paid ${formatMoney(data.totalCents)}.`,
      heading: "New paid order",
      body: `
        <p style="margin:0 0 16px;">
          <strong>${escapeHtml(data.orderNumber)}</strong> — ${escapeHtml(data.customerName)}
          (${escapeHtml(data.email)})
        </p>
        ${renderPanel(`${renderLines(data.lines)}${renderTotals(data)}`)}
        ${renderButton({ label: "Open in admin", url: adminUrl })}`,
    }),
    text: renderText("New paid order", [
      `${data.orderNumber} — ${data.customerName} (${data.email})`,
      "",
      ...linesText(data.lines),
      "",
      `Total paid (${data.currency}): ${formatMoney(data.totalCents)}`,
      "",
      adminUrl,
    ]),
  };
}

/** Sent when a refund is confirmed by the provider. Access is already revoked. */
export function orderRefundedTemplate(data: OrderEmailData): EmailMessage {
  const orderUrl = emailUrl(`/orders/${encodeURIComponent(data.orderNumber)}`);

  return {
    to: data.email,
    subject: `Your ${emailConfig.brand} order ${data.orderNumber} was refunded`,
    html: renderLayout({
      preheader: `Order ${data.orderNumber} has been refunded.`,
      heading: "Your order was refunded",
      body: `
        <p style="margin:0 0 16px;">Hi ${escapeHtml(firstName(data.customerName))},</p>
        <p style="margin:0 0 16px;">
          Order <strong>${escapeHtml(data.orderNumber)}</strong> has been refunded for
          ${escapeHtml(formatMoney(data.totalCents))}. The refund is issued by our payment
          provider and may take a few working days to appear.
        </p>
        <p style="margin:0 0 16px;">
          Access to the downloads from this order has been withdrawn.
        </p>
        ${renderButton({ label: "View this order", url: orderUrl })}`,
    }),
    text: renderText("Your order was refunded", [
      `Hi ${firstName(data.customerName)},`,
      "",
      `Order ${data.orderNumber} has been refunded for ${formatMoney(data.totalCents)}.`,
      "Access to the downloads from this order has been withdrawn.",
      "",
      orderUrl,
    ]),
  };
}
