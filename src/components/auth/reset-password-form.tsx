"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { FormField } from "@/components/auth/form-field";
import { resetPasswordAction } from "@/lib/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, null);

  if (state?.ok) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-alt px-6 py-10 text-center"
      >
        <CheckCircle2 className="size-8 text-success" aria-hidden />
        <h2 className="font-semibold text-foreground">Password updated</h2>
        <p className="text-body">{state.message}</p>
        <ButtonLink href="/login" variant="brand" size="pill" className="mt-3">
          Go to sign in
        </ButtonLink>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />

      {state && !state.ok && !state.fieldErrors && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <span className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.error}
          </span>
          <Link href="/forgot-password" className="font-semibold underline">
            Request a new link
          </Link>
        </div>
      )}

      <FormField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
        error={state && !state.ok ? state.fieldErrors?.password : undefined}
      />

      <FormField
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={state && !state.ok ? state.fieldErrors?.confirmPassword : undefined}
      />

      <Button
        type="submit"
        variant="brand"
        size="pill"
        className="w-full"
        disabled={pending}
      >
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? "Updating…" : "Set new password"}
      </Button>
    </form>
  );
}
