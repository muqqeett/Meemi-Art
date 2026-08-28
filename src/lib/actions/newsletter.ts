"use server";

import { z } from "zod";

import { emailSchema } from "@/lib/validations/auth";

const subscribeSchema = z.object({
  firstName: z.string().trim().max(80).optional().or(z.literal("")),
  email: emailSchema,
});

export type NewsletterState =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Newsletter signup.
 *
 * There is no ESP configured in development, so this validates the input and
 * records the intent in the server log rather than pretending a subscription
 * was created. Swap the logging line for a real provider call in production.
 */
export async function subscribeToNewsletter(
  _prev: NewsletterState | null,
  formData: FormData,
): Promise<NewsletterState> {
  const parsed = subscribeSchema.safeParse({
    firstName: formData.get("firstName"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Check the details below.", fieldErrors };
  }

  console.info(
    `[newsletter] Signup: ${parsed.data.email}${
      parsed.data.firstName ? ` (${parsed.data.firstName})` : ""
    }`,
  );

  return {
    ok: true,
    message: "Use code WELCOME15 at checkout for 15% off your first order.",
  };
}
