"use server";

import { randomBytes, createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";

import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/auth";
import { requireUser } from "@/lib/auth-guards";
import { mergeGuestCartIntoUser } from "@/lib/cart/cart-service";
import { issueVerificationEmail } from "@/lib/actions/verification";
import {
  sendEmail,
  withinRateLimit,
  resetPasswordTemplate,
  passwordChangedTemplate,
  EMAIL_TEMPLATES,
} from "@/lib/email";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  profileSchema,
} from "@/lib/validations/auth";
import { allowLoginAttempt, clearLoginAttempts } from "@/lib/security/login-throttle";

/**
 * React resets an uncontrolled form after a form action resolves, so a failed
 * submit would otherwise wipe everything the user typed. Failed results carry
 * the non-secret values back so the fields can be repopulated. Passwords are
 * never echoed.
 */
export type AuthResult =
  | { ok: true; message?: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
      values?: Record<string, string>;
    };

function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function flattenIssues(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/** Only allow relative callback paths — never an attacker-supplied origin. */
function safeCallback(callbackUrl?: string | null): string {
  if (!callbackUrl) return "/account";
  if (!callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) return "/account";
  return callbackUrl;
}

// ------------------------------------------------------------------ sign in

export async function loginAction(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the details below.",
      fieldErrors: flattenIssues(parsed.error.issues),
      values: { email: textField(formData, "email") },
    };
  }

  /**
   * Throttle before the password is checked.
   *
   * bcrypt at cost 12 makes each guess cost about a quarter of a second, which
   * slows an attacker without stopping one; nothing else limited this path.
   * Counted by address and by source — see `lib/security/login-throttle.ts`,
   * including an honest note on what an in-process counter cannot do.
   *
   * The refusal deliberately reads differently from a wrong password. It
   * discloses nothing about whether the account exists — it is a statement
   * about how many attempts arrived, which is true regardless — and a customer
   * who has genuinely mistyped several times is owed an explanation rather
   * than a fifth identical rejection.
   */
  if (!(await allowLoginAttempt(parsed.data.email))) {
    return {
      ok: false,
      error: "Too many sign-in attempts. Please wait a few minutes and try again.",
      values: { email: parsed.data.email },
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Deliberately generic: never confirm whether the email exists.
      return {
        ok: false,
        error: "That email or password isn't right.",
        values: { email: parsed.data.email },
      };
    }
    throw error;
  }

  // Signed in: this address starts clean again, so a customer who fumbled a
  // few times is not carrying a nearly-spent budget into their next session.
  //
  // Awaited because the clear now reaches a shared store: `redirect()` below
  // unwinds this function by throwing, and an un-awaited delete could be
  // abandoned before it lands.
  await clearLoginAttempts(parsed.data.email);

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (user) await mergeGuestCartIntoUser(user.id);

  revalidatePath("/", "layout");
  redirect(safeCallback(formData.get("callbackUrl") as string | null));
}

// ------------------------------------------------------------------ register

export async function registerAction(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the details below.",
      fieldErrors: flattenIssues(parsed.error.issues),
      values: {
        name: textField(formData, "name"),
        email: textField(formData, "email"),
      },
    };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    return {
      ok: false,
      error: "An account with that email already exists.",
      fieldErrors: { email: "An account with that email already exists." },
      values: { name, email },
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "CUSTOMER",
      // `emailVerified` is deliberately left null — the address is a claim
      // until the verification link is followed.
      wishlist: { create: {} },
    },
    select: { id: true, email: true, name: true },
  });

  // Issued before sign-in so a mail failure cannot leave the account without a
  // pending token. Sending never throws.
  await issueVerificationEmail(user);

  // The shopper is still signed in: an unverified account can browse and buy,
  // but the verification banner persists until the address is confirmed. This
  // preserves the existing session architecture rather than replacing it.
  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "Account created — please sign in." };
    }
    throw error;
  }

  await mergeGuestCartIntoUser(user.id);
  revalidatePath("/", "layout");
  redirect(`/verify-email/sent?email=${encodeURIComponent(email)}`);
}

// ------------------------------------------------------------------ sign out

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

// ------------------------------------------------------------------ password reset

const RESET_TOKEN_TTL_MINUTES = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function forgotPasswordAction(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Enter a valid email address.",
      fieldErrors: flattenIssues(parsed.error.issues),
      values: { email: textField(formData, "email") },
    };
  }

  const email = parsed.data.email;

  // Throttled per address. When the limit is hit nothing is sent, but the
  // response below is unchanged — a visible throttle would itself confirm the
  // address exists.
  const allowed = await withinRateLimit(email, EMAIL_TEMPLATES.resetPassword, {
    max: 3,
    windowMinutes: 60,
  });

  const user = allowed
    ? await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true },
      })
    : null;

  if (user) {
    // Only the hash is stored, so a database leak cannot be used to reset
    // passwords. The raw token exists only in the emailed link and is never
    // written to logs.
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);

    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expires },
    });

    await sendEmail({
      ...resetPasswordTemplate({
        to: user.email,
        name: user.name,
        token,
        expiresMinutes: RESET_TOKEN_TTL_MINUTES,
      }),
      template: EMAIL_TEMPLATES.resetPassword,
    });
  }

  // Identical response either way — this must not reveal registration status.
  return {
    ok: true,
    message:
      "If an account exists for that address, we've sent a link to reset your password.",
  };
}

export async function resetPasswordAction(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the details below.",
      fieldErrors: flattenIssues(parsed.error.issues),
    };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
    select: {
      id: true,
      userId: true,
      expires: true,
      usedAt: true,
      user: { select: { email: true, name: true } },
    },
  });

  if (!record || record.usedAt || record.expires < new Date()) {
    return {
      ok: false,
      error: "That reset link is invalid or has expired. Request a new one.",
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Any active sessions belong to whoever had the old password.
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);

  // Notify after the change lands. Not deduped: every genuine password change
  // is worth telling the owner about.
  await sendEmail({
    ...passwordChangedTemplate({
      to: record.user.email,
      name: record.user.name,
    }),
    template: EMAIL_TEMPLATES.passwordChanged,
  });

  return { ok: true, message: "Password updated. You can sign in now." };
}

// ------------------------------------------------------------------ account settings

export async function changePasswordAction(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const user = await requireUser("/account/settings");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the details below.",
      fieldErrors: flattenIssues(parsed.error.issues),
    };
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!record?.passwordHash) {
    return { ok: false, error: "This account doesn't use a password." };
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, record.passwordHash);
  if (!valid) {
    return {
      ok: false,
      error: "Your current password isn't right.",
      fieldErrors: { currentPassword: "Your current password isn't right." },
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) },
  });

  return { ok: true, message: "Password updated." };
}

export async function updateProfileAction(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const user = await requireUser("/account/settings");

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the details below.",
      fieldErrors: flattenIssues(parsed.error.issues),
      values: {
        name: textField(formData, "name"),
        phone: textField(formData, "phone"),
      },
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
    },
  });

  revalidatePath("/account", "layout");
  return { ok: true, message: "Profile updated." };
}
