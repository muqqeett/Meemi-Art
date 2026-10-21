"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

import { FormField } from "@/components/auth/form-field";
import { AuthStatus } from "@/components/auth/plum-auth";
import { plumAlert, plumLink, plumPrimary } from "@/components/auth/plum-auth-styles";
import { resetPasswordAction } from "@/lib/actions/auth";

/**
 * Sets a new password from a reset link — presentation only. The hidden token,
 * the action and the way errors come back are exactly what `resetPasswordAction`
 * expects.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, null);

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <AuthStatus icon={CheckCircle2} title="Password updated">
          <p>{state.message}</p>
        </AuthStatus>
        <Link href="/login" className={plumPrimary}>
          Log in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />

      {state && !state.ok && !state.fieldErrors && (
        <div role="alert" className={`${plumAlert} flex-col`}>
          <span className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.error}
          </span>
          <Link href="/forgot-password" className={`${plumLink} w-fit`}>
            Request a new link
          </Link>
        </div>
      )}

      <FormField
        variant="plum"
        label="New password"
        name="password"
        type="password"
        placeholder="Choose a new password"
        autoComplete="new-password"
        required
        hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
        error={state && !state.ok ? state.fieldErrors?.password : undefined}
      />

      <FormField
        variant="plum"
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        placeholder="Type it again"
        autoComplete="new-password"
        required
        error={state && !state.ok ? state.fieldErrors?.confirmPassword : undefined}
      />

      <button type="submit" className={plumPrimary} disabled={pending} aria-busy={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {pending ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}
