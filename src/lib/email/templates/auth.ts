import "server-only";

import {
  renderLayout,
  renderText,
  renderButton,
  renderPanel,
  escapeHtml,
} from "@/lib/email/templates/layout";
import { emailConfig, emailUrl } from "@/lib/email/config";
import type { EmailMessage } from "@/lib/email/types";

/** First name only — emails read warmer without a surname. */
function firstName(name: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first || "there";
}

const SECURITY_NOTE = `${emailConfig.brand} will never ask for your password by email.`;

export function verifyEmailTemplate(args: {
  to: string;
  name: string | null;
  token: string;
  expiresMinutes: number;
}): EmailMessage {
  const link = emailUrl(`/verify-email?token=${encodeURIComponent(args.token)}`);
  const greeting = firstName(args.name);

  return {
    to: args.to,
    subject: `Verify your ${emailConfig.brand} email address`,
    html: renderLayout({
      preheader: `Confirm your email to activate your ${emailConfig.brand} account.`,
      heading: `Welcome to ${emailConfig.brand}`,
      body: `
        <p style="margin:0 0 14px;">Hi ${escapeHtml(greeting)},</p>
        <p style="margin:0 0 14px;">
          Thank you for creating your ${escapeHtml(emailConfig.brand)} account. Please confirm
          your email address to activate it.
        </p>
        ${renderButton({ label: "Verify my email", url: link })}
        <p style="margin:0 0 14px;font-size:13px;color:#6f6a75;">
          This link expires in ${args.expiresMinutes} minutes and can be used once.
        </p>
        <p style="margin:0;font-size:13px;color:#6f6a75;">
          If you did not create this account, you can safely ignore this email.
        </p>`,
    }),
    text: renderText(`Welcome to ${emailConfig.brand}`, [
      `Hi ${greeting},`,
      "",
      `Thank you for creating your ${emailConfig.brand} account. Confirm your email address to activate it:`,
      link,
      "",
      `This link expires in ${args.expiresMinutes} minutes and can be used once.`,
      "If you did not create this account, you can safely ignore this email.",
    ]),
  };
}

export function welcomeTemplate(args: {
  to: string;
  name: string | null;
}): EmailMessage {
  const greeting = firstName(args.name);
  const shopUrl = emailUrl("/shop");

  return {
    to: args.to,
    subject: `Welcome to ${emailConfig.brand}`,
    html: renderLayout({
      preheader: "Your account is verified and ready.",
      heading: "Your account is ready",
      body: `
        <p style="margin:0 0 14px;">Hi ${escapeHtml(greeting)},</p>
        <p style="margin:0 0 14px;">
          Your email is verified and your ${escapeHtml(emailConfig.brand)} account is active.
          You can now track orders, save pieces to a wishlist and check out faster.
        </p>
        <p style="margin:0 0 14px;">
          Everything we make is worked by hand in small batches, so pieces come and go.
        </p>
        ${renderButton({ label: "Browse the collection", url: shopUrl })}
        <p style="margin:0;font-size:13px;color:#6f6a75;">
          Need a hand with anything? Just reply to this email.
        </p>`,
    }),
    text: renderText("Your account is ready", [
      `Hi ${greeting},`,
      "",
      `Your email is verified and your ${emailConfig.brand} account is active.`,
      "You can now track orders, save pieces to a wishlist and check out faster.",
      "",
      `Browse the collection: ${shopUrl}`,
    ]),
  };
}

export function resetPasswordTemplate(args: {
  to: string;
  name: string | null;
  token: string;
  expiresMinutes: number;
}): EmailMessage {
  const link = emailUrl(`/reset-password?token=${encodeURIComponent(args.token)}`);
  const greeting = firstName(args.name);

  return {
    to: args.to,
    subject: `Reset your ${emailConfig.brand} password`,
    html: renderLayout({
      preheader: "A link to choose a new password.",
      heading: "Reset your password",
      body: `
        <p style="margin:0 0 14px;">Hi ${escapeHtml(greeting)},</p>
        <p style="margin:0 0 14px;">
          We received a request to reset the password on your
          ${escapeHtml(emailConfig.brand)} account.
        </p>
        ${renderButton({ label: "Reset password", url: link })}
        <p style="margin:0 0 14px;font-size:13px;color:#6f6a75;">
          This link expires in ${args.expiresMinutes} minutes and can be used once.
        </p>
        ${renderPanel(`
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#15121a;">
            If you didn't request this, you can safely ignore this email — your password
            will not change. ${escapeHtml(SECURITY_NOTE)}
          </p>`)}`,
    }),
    text: renderText("Reset your password", [
      `Hi ${greeting},`,
      "",
      `We received a request to reset the password on your ${emailConfig.brand} account.`,
      link,
      "",
      `This link expires in ${args.expiresMinutes} minutes and can be used once.`,
      "If you didn't request this, you can safely ignore this email — your password will not change.",
      SECURITY_NOTE,
    ]),
  };
}

export function passwordChangedTemplate(args: {
  to: string;
  name: string | null;
}): EmailMessage {
  const greeting = firstName(args.name);
  const supportUrl = emailUrl("/contact");

  return {
    to: args.to,
    subject: `Your ${emailConfig.brand} password was changed`,
    html: renderLayout({
      preheader: "Confirmation that your password was updated.",
      heading: "Your password was changed",
      body: `
        <p style="margin:0 0 14px;">Hi ${escapeHtml(greeting)},</p>
        <p style="margin:0 0 14px;">
          The password on your ${escapeHtml(emailConfig.brand)} account was changed
          successfully. You have been signed out everywhere else.
        </p>
        <p style="margin:0 0 14px;">If you made this change, nothing further is needed.</p>
        ${renderPanel(`
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#15121a;">
            <strong>Didn't do this?</strong> Contact us straight away so we can secure your account.
          </p>`)}
        ${renderButton({ label: "Contact support", url: supportUrl })}`,
    }),
    text: renderText("Your password was changed", [
      `Hi ${greeting},`,
      "",
      `The password on your ${emailConfig.brand} account was changed successfully.`,
      "You have been signed out everywhere else.",
      "",
      "If you made this change, nothing further is needed.",
      `If you did not, contact us straight away: ${supportUrl}`,
    ]),
  };
}
