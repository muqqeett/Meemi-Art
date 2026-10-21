"use client";

import { useActionState } from "react";
import { Loader2, AlertCircle, MailCheck } from "lucide-react";

import { FormField } from "@/components/auth/form-field";
import { AuthStatus } from "@/components/auth/plum-auth";
import { plumAlert, plumNotice, plumPrimary } from "@/components/auth/plum-auth-styles";
import { forgotPasswordAction } from "@/lib/actions/auth";
import { authConfig } from "@/lib/config";

/**
 * Asks for a reset link — presentation only. The action, the field name and the
 * deliberately identical outcome for known and unknown addresses are untouched.
 *
 * When the site has no mail provider the action says so (`emailUnavailable`),
 * the same for every address, and this screen must not dress that up as a send.
 */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, null);

  if (state?.ok && state.emailUnavailable) {
    return (
      <p role="status" className={plumNotice}>
        {state.message}
      </p>
    );
  }

  if (state?.ok) {
    return (
      <AuthStatus icon={MailCheck} title="Check your inbox">
        <p>{state.message}</p>
        <p className="text-[13px] leading-[18px] font-medium">
          The link expires in {authConfig.resetTtlMinutes} minutes. Check your spam
          folder if it hasn&apos;t arrived in a few minutes.
        </p>
      </AuthStatus>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state && !state.ok && !state.fieldErrors && (
        <div role="alert" className={plumAlert}>
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <FormField
        variant="plum"
        label="Email"
        name="email"
        type="email"
        placeholder="name@mail.com"
        autoComplete="email"
        required
        defaultValue={state && !state.ok ? state.values?.email : undefined}
        error={state && !state.ok ? state.fieldErrors?.email : undefined}
      />

      <button type="submit" className={plumPrimary} disabled={pending} aria-busy={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
