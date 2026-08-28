import "server-only";

import { prisma } from "@/lib/prisma";
import { emailConfig } from "@/lib/email/config";
import { resendProvider } from "@/lib/email/resend";
import type { EmailMessage, EmailProvider, EmailTemplate } from "@/lib/email/types";

/**
 * The single place the application sends mail from.
 *
 * Every attempt is written to `EmailLog`, which gives delivery history,
 * idempotency and rate limiting from one table — no queue or Redis required.
 *
 * Three deliberate rules:
 *
 *  1. With no provider configured nothing is sent and the row is recorded as
 *     SKIPPED. The system never reports success for an email that did not
 *     leave the building.
 *  2. Sending never throws. A transactional email failing must not fail the
 *     checkout or password reset that triggered it.
 *  3. Tokens are never logged. Only recipient, template and subject are
 *     stored, so the log can be read without leaking a reset link.
 */

function getProvider(): EmailProvider {
  return resendProvider;
}

export type SendResult = {
  status: "SENT" | "SKIPPED" | "FAILED" | "DUPLICATE";
  providerId?: string | null;
  error?: string;
};

export type SendArgs = EmailMessage & {
  template: EmailTemplate;
  /**
   * Natural key making this email send at most once — e.g.
   * `order-confirmation:<orderId>`. Omit for mail that may legitimately
   * repeat, such as a second password reset request.
   */
  dedupeKey?: string;
};

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const { template, dedupeKey, ...message } = args;

  // Idempotency: a retried checkout must not produce a second confirmation.
  if (dedupeKey) {
    const existing = await prisma.emailLog.findUnique({
      where: { dedupeKey },
      select: { id: true, status: true },
    });
    // Only a successful send blocks a retry — a previous failure should be
    // allowed to try again.
    if (existing && existing.status === "SENT") {
      return { status: "DUPLICATE" };
    }
    if (existing) {
      await prisma.emailLog.delete({ where: { id: existing.id } });
    }
  }

  const provider = getProvider();

  if (!provider.isConfigured) {
    await recordAttempt({
      to: message.to,
      template,
      subject: message.subject,
      status: "SKIPPED",
      error: "No email provider configured (RESEND_API_KEY unset).",
      dedupeKey,
    });
    return {
      status: "SKIPPED",
      error: "Email provider is not configured.",
    };
  }

  const outcome = await provider.send(message);

  await recordAttempt({
    to: message.to,
    template,
    subject: message.subject,
    status: outcome.ok ? "SENT" : "FAILED",
    providerId: outcome.ok ? outcome.providerId : null,
    error: outcome.ok ? null : outcome.error,
    dedupeKey,
  });

  return outcome.ok
    ? { status: "SENT", providerId: outcome.providerId }
    : { status: "FAILED", error: outcome.error };
}

async function recordAttempt(row: {
  to: string;
  template: EmailTemplate;
  subject: string;
  status: "SENT" | "SKIPPED" | "FAILED";
  providerId?: string | null;
  error?: string | null;
  dedupeKey?: string;
}): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        to: row.to,
        template: row.template,
        subject: row.subject,
        status: row.status,
        providerId: row.providerId ?? null,
        error: row.error ?? null,
        dedupeKey: row.dedupeKey ?? null,
      },
    });
  } catch (error) {
    // Logging must never break the caller either.
    console.error("[email] could not record delivery attempt", error);
  }
}

/**
 * Simple per-recipient throttle backed by the same log table.
 *
 * Returns false when the recipient has already been sent `max` of this
 * template inside the window. Callers must still return a generic response so
 * the limit cannot be used to probe which addresses exist.
 */
export async function withinRateLimit(
  to: string,
  template: EmailTemplate,
  options: { max: number; windowMinutes: number },
): Promise<boolean> {
  const since = new Date(Date.now() - options.windowMinutes * 60_000);

  const recent = await prisma.emailLog.count({
    where: { to, template, createdAt: { gte: since } },
  });

  return recent < options.max;
}

/** Whether transactional email can currently be delivered. */
export function isEmailConfigured(): boolean {
  return Boolean(emailConfig.apiKey && emailConfig.from);
}
