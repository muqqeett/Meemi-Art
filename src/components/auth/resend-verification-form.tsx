"use client";

import { useActionState } from "react";
import { Loader2, MailCheck } from "lucide-react";

import { FormField } from "@/components/auth/form-field";
import {
  plumNotice,
  plumPrimary,
  plumSecondary,
  plumSuccess,
} from "@/components/auth/plum-auth-styles";
import { resendVerificationEmail } from "@/lib/actions/verification";

/**
 * Requests a fresh verification link.
 *
 * The success message is deliberately identical whether or not the address is
 * registered, and whether or not the rate limit was hit — anything else would
 * let a visitor enumerate accounts.
 *
 * `emphasis` only decides how loud the button is: on a broken-link page this is
 * the one thing to do, so it is the primary action; beside "Browse patterns" on
 * the post-sign-up page it is the quiet one.
 */
export function ResendVerificationForm({
  defaultEmail = "",
  emphasis = "primary",
}: {
  defaultEmail?: string;
  emphasis?: "primary" | "secondary";
}) {
  const [state, formAction, pending] = useActionState(resendVerificationEmail, null);

  // No mail provider: the action says nothing was sent, so no success styling.
  if (state?.ok && state.emailUnavailable) {
    return (
      <p role="status" className={plumNotice}>
        {state.message}
      </p>
    );
  }

  if (state?.ok) {
    return (
      <p role="status" className={plumSuccess}>
        <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormField
        variant="plum"
        label="Email"
        name="email"
        type="email"
        placeholder="name@mail.com"
        autoComplete="email"
        required
        defaultValue={defaultEmail}
        error={state && !state.ok ? state.error : undefined}
      />

      <button
        type="submit"
        className={emphasis === "primary" ? plumPrimary : plumSecondary}
        disabled={pending}
        aria-busy={pending}
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {pending ? "Sending…" : "Send a new link"}
      </button>
    </form>
  );
}
