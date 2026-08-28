"use client";

import { useActionState } from "react";
import { Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/form-field";
import { resendVerificationEmail } from "@/lib/actions/verification";

/**
 * Requests a fresh verification link.
 *
 * The success message is deliberately identical whether or not the address is
 * registered, and whether or not the rate limit was hit — anything else would
 * let a visitor enumerate accounts.
 */
export function ResendVerificationForm({
  defaultEmail = "",
}: {
  defaultEmail?: string;
}) {
  const [state, formAction, pending] = useActionState(resendVerificationEmail, null);

  if (state?.ok) {
    return (
      <p
        role="status"
        className="flex items-start gap-2.5 border border-success/30 bg-success/5 px-4 py-3 text-sm text-success"
      >
        <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormField
        label="Email"
        name="email"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        required
        defaultValue={defaultEmail}
        error={state && !state.ok ? state.error : undefined}
      />

      <Button
        type="submit"
        variant="brand"
        size="pill"
        className="w-full"
        disabled={pending}
      >
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? "Sending…" : "Send a new link"}
      </Button>
    </form>
  );
}
