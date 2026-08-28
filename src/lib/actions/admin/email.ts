"use server";

import { getAdminOrNull } from "@/lib/auth-guards";
import { emailSchema } from "@/lib/validations/auth";
import {
  EMAIL_TEMPLATES,
  isEmailConfigured,
  sendEmail,
  testEmailTemplate,
  withinRateLimit,
} from "@/lib/email";

/**
 * Admin-triggered deliverability check.
 *
 * Three guards, in order:
 *
 *  1. Admin session, checked server-side on every call. A server action is a
 *     public HTTP endpoint — the button being hidden proves nothing.
 *  2. Address validation, so the form cannot be used to push arbitrary strings
 *     at the provider.
 *  3. A per-recipient rate limit, which stops the endpoint from being turned
 *     into a way to mail somebody repeatedly even by an authenticated admin.
 *
 * When no provider is configured this reports exactly that, rather than
 * returning success for a message that never left.
 */

const TEST_LIMIT = { max: 5, windowMinutes: 60 };

export type TestEmailResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function sendTestEmail(
  _prev: TestEmailResult | null,
  formData: FormData,
): Promise<TestEmailResult> {
  const admin = await getAdminOrNull();
  if (!admin) {
    return { ok: false, error: "You don't have permission to do that." };
  }

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address." };
  }
  const to = parsed.data;

  if (!isEmailConfigured()) {
    return {
      ok: false,
      error:
        "No email provider is configured. Set RESEND_API_KEY and EMAIL_FROM, then try again.",
    };
  }

  const allowed = await withinRateLimit(to, EMAIL_TEMPLATES.test, TEST_LIMIT);
  if (!allowed) {
    return {
      ok: false,
      error: `That address has already had ${TEST_LIMIT.max} test emails this hour.`,
    };
  }

  const result = await sendEmail({
    ...testEmailTemplate({ to, sentBy: admin.email }),
    template: EMAIL_TEMPLATES.test,
  });

  switch (result.status) {
    case "SENT":
      return { ok: true, message: `Test email sent to ${to}.` };
    case "SKIPPED":
      return {
        ok: false,
        error: "Nothing was sent — the email provider is not configured.",
      };
    case "DUPLICATE":
      return { ok: true, message: `Test email already sent to ${to}.` };
    default:
      // The provider's message is safe to surface: it describes the request,
      // not the credential. Resend returns things like "domain not verified",
      // which is exactly what the operator needs to read.
      return {
        ok: false,
        error: result.error ?? "The provider rejected the message.",
      };
  }
}
