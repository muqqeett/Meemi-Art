import "server-only";

/**
 * Email provider contract.
 *
 * Kept deliberately small so Resend can be swapped for another transport
 * without touching a single template or call site. Nothing here is imported by
 * client code — `server-only` makes that a build error rather than a leak.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  /** Full HTML body. Templates inline every style; no external CSS. */
  html: string;
  /** Plain-text alternative. Every template supplies one. */
  text: string;
  replyTo?: string;
};

export type SendOutcome =
  | { ok: true; providerId: string | null }
  | { ok: false; error: string };

export interface EmailProvider {
  /** Human-readable driver name, surfaced in admin settings. */
  readonly name: string;
  /** False when credentials are absent — the service then records SKIPPED. */
  readonly isConfigured: boolean;
  send(message: EmailMessage): Promise<SendOutcome>;
}

/** Template identifiers, used for logging, dedupe keys and rate limiting. */
export const EMAIL_TEMPLATES = {
  verifyEmail: "verify-email",
  welcome: "welcome",
  resetPassword: "reset-password",
  passwordChanged: "password-changed",
  purchaseReady: "purchase-ready",
  orderRefunded: "order-refunded",
  adminNewOrder: "admin-new-order",
  /** Admin-triggered deliverability check. Never sent by customer actions. */
  test: "test",
} as const;

export type EmailTemplate = (typeof EMAIL_TEMPLATES)[keyof typeof EMAIL_TEMPLATES];
