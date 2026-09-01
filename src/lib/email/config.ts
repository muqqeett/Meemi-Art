import "server-only";

import { siteConfig } from "@/lib/config";

/**
 * Email environment, read once on the server.
 *
 * Every value is configurable so the sending domain and brand can change
 * without a code edit. `RESEND_API_KEY` is intentionally not exported — only
 * `apiKey` inside this server-only module reads it, and nothing serialises it
 * to the client.
 */

/**
 * The display name out of an RFC 5322 address.
 *
 *   `Meemi Art <hello@meemiart.com>`   -> Meemi Art
 *   `"Meemi Art" <hello@meemi.com>`   -> Meemi Art
 *   `hello@meemiart.com`              -> null
 *
 * Deriving the brand from `EMAIL_FROM` rather than adding a second variable
 * keeps them from drifting: an operator who changes the sender cannot end up
 * with mail signed by one name and sent from another.
 */
function displayName(address: string): string | null {
  const match = address.match(/^\s*(.+?)\s*<[^>]+>\s*$/);
  if (!match) return null;
  return match[1].replace(/^"(.*)"$/, "$1").trim() || null;
}

/** The bare address out of an RFC 5322 address, for reply-to and mailto links. */
function bareAddress(address: string): string {
  const match = address.match(/<([^>]+)>/);
  return (match ? match[1] : address).trim();
}

const from = process.env.EMAIL_FROM ?? "";
const replyTo = process.env.EMAIL_REPLY_TO ?? "";

export const emailConfig = {
  apiKey: process.env.RESEND_API_KEY ?? "",
  from,
  replyTo,
  /**
   * Brand name used in subjects, headings and signatures. Taken from the
   * sender's display name so mail is signed by whoever it is sent by; falls
   * back to the storefront name when `EMAIL_FROM` is a bare address.
   */
  brand: displayName(from) ?? siteConfig.name,
  /** Just the address part of the reply-to, for `mailto:` links in templates. */
  replyToAddress: replyTo ? bareAddress(replyTo) : "",
  /**
   * Where internal new-order notifications go. Falls back to the reply-to
   * address: a shop with a single mailbox should not need a second variable to
   * receive its own order alerts.
   */
  adminEmail: process.env.ADMIN_EMAIL || (replyTo ? bareAddress(replyTo) : ""),
  /**
   * Absolute base for links inside emails. Emails are read outside the app, so
   * relative URLs are useless here.
   */
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.SITE_URL ??
    siteConfig.url,
} as const;

/** Absolute URL builder for links embedded in emails. */
export function emailUrl(path: string): string {
  const base = emailConfig.appUrl.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Shown in admin settings so the operator knows whether mail can go out. */
export function describeEmail(): {
  provider: string;
  isConfigured: boolean;
  brand: string;
  from: string;
  replyTo: string;
  adminEmail: string;
  siteUrl: string;
  hint: string;
} {
  const configured = Boolean(emailConfig.apiKey && emailConfig.from);

  return {
    provider: "Resend",
    isConfigured: configured,
    brand: emailConfig.brand,
    from: emailConfig.from || "(not set)",
    replyTo: emailConfig.replyTo || "(not set)",
    adminEmail: emailConfig.adminEmail || "(not set)",
    siteUrl: emailConfig.appUrl,
    hint: configured
      ? "Transactional email is live. Every send is recorded in the email log."
      : "No RESEND_API_KEY set — emails are recorded as skipped and nothing is sent.",
  };
}
