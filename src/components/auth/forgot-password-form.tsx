"use client";

import { useActionState } from "react";
import { Loader2, AlertCircle, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/form-field";
import { forgotPasswordAction } from "@/lib/actions/auth";

export function ForgotPasswordForm({
  emailConfigured = true,
}: {
  /** False when no mail provider is set up — the screen must not imply a send. */
  emailConfigured?: boolean;
}) {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, null);

  if (state?.ok) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-alt px-6 py-10 text-center"
      >
        <MailCheck className="size-8 text-success" aria-hidden />
        <h2 className="font-semibold text-foreground">
          {emailConfigured ? "Check your inbox" : "Request received"}
        </h2>
        <p className="text-body">{state.message}</p>
        {emailConfigured ? (
          <p className="mt-2 text-xs text-muted-foreground">
            The link expires in 30 minutes. Check your spam folder if it hasn&apos;t
            arrived in a few minutes.
          </p>
        ) : (
          <p className="mt-2 text-xs text-warning">
            Email delivery isn&apos;t configured on this environment, so no message was
            actually sent.
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state && !state.ok && !state.fieldErrors && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <FormField
        label="Email"
        name="email"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        required
        defaultValue={state && !state.ok ? state.values?.email : undefined}
        error={state && !state.ok ? state.fieldErrors?.email : undefined}
      />

      <Button
        type="submit"
        variant="brand"
        size="pill"
        className="w-full"
        disabled={pending}
      >
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
