"use server";

import { randomBytes, createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import {
  sendEmail,
  withinRateLimit,
  verifyEmailTemplate,
  welcomeTemplate,
  EMAIL_TEMPLATES,
} from "@/lib/email";
import { emailSchema } from "@/lib/validations/auth";
import { authConfig } from "@/lib/config";

/**
 * Email ownership verification.
 *
 * Mirrors the password-reset design already in this codebase: a 256-bit random
 * token is emailed, only its SHA-256 hash is stored, and the row is
 * single-use and time-limited. Tokens are never logged.
 */

const TTL_MINUTES = authConfig.verificationTtlMinutes;

const RESEND_LIMIT = { max: authConfig.verificationResendPerHour, windowMinutes: 60 };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a token and email it. Returns quietly on every path — callers must not
 * expose whether an address exists.
 *
 * Exported for use immediately after registration, where the caller already
 * knows the user is real.
 */
export async function issueVerificationEmail(user: {
  id: string;
  email: string;
  name: string | null;
}): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TTL_MINUTES * 60_000);

  // Any earlier unused token for this account is discarded, so only the newest
  // link works.
  await prisma.emailVerificationToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      email: user.email,
      tokenHash: hashToken(token),
      expires,
    },
  });

  await sendEmail({
    ...verifyEmailTemplate({
      to: user.email,
      name: user.name,
      token,
      expiresMinutes: TTL_MINUTES,
    }),
    template: EMAIL_TEMPLATES.verifyEmail,
  });
}

export type VerificationResult =
  | { ok: true; alreadyVerified: boolean }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/**
 * Consume a verification token.
 *
 * Invalid, expired and already-used tokens are reported distinctly so the page
 * can offer the right next step — none of these states reveals whether a given
 * email address is registered, because the caller only ever holds a token.
 */
export async function verifyEmailToken(token: string): Promise<VerificationResult> {
  if (!token || token.length < 32) return { ok: false, reason: "invalid" };

  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      userId: true,
      email: true,
      expires: true,
      usedAt: true,
      user: { select: { name: true, emailVerified: true } },
    },
  });

  if (!record) return { ok: false, reason: "invalid" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expires < new Date()) return { ok: false, reason: "expired" };

  const alreadyVerified = Boolean(record.user.emailVerified);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // Welcome mail only on the first successful verification, and keyed by user
  // so a re-verify can never send it twice.
  if (!alreadyVerified) {
    await sendEmail({
      ...welcomeTemplate({ to: record.email, name: record.user.name }),
      template: EMAIL_TEMPLATES.welcome,
      dedupeKey: `welcome:${record.userId}`,
    });
  }

  return { ok: true, alreadyVerified };
}

export type ResendResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Request a fresh verification email.
 *
 * Always returns the same message whether or not the address exists, and is
 * rate limited per address so it cannot be used to flood an inbox.
 */
export async function resendVerificationEmail(
  _prev: ResendResult | null,
  formData: FormData,
): Promise<ResendResult> {
  const parsed = emailSchema.safeParse(formData.get("email"));

  const generic =
    "If that address needs verifying, we've sent a new link. Check your inbox.";

  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const email = parsed.data;

  const allowed = await withinRateLimit(email, EMAIL_TEMPLATES.verifyEmail, RESEND_LIMIT);
  if (!allowed) {
    // Deliberately the same shape as success — a throttle message that only
    // appeared for real accounts would leak which addresses exist.
    return { ok: true, message: generic };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, emailVerified: true },
  });

  if (user && !user.emailVerified) {
    await issueVerificationEmail(user);
  }

  return { ok: true, message: generic };
}
