"use client";

import { useActionState } from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/form-field";
import { updateProfileAction, changePasswordAction } from "@/lib/actions/auth";
import type { AuthResult } from "@/lib/actions/auth";

function Feedback({ state }: { state: AuthResult | null }) {
  if (!state) return null;

  if (state.ok) {
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success"
      >
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        {state.message ?? "Saved."}
      </p>
    );
  }

  if (state.fieldErrors) return null;

  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {state.error}
    </p>
  );
}

export function ProfileForm({
  defaultName,
  defaultPhone,
  email,
}: {
  defaultName: string;
  defaultPhone: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  // Keep what the user typed if the submit was rejected.
  const kept = state && !state.ok ? state.values : undefined;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-semibold text-foreground">Profile</h2>
      <p className="text-body mt-1">How we address you and reach you about orders.</p>

      <form action={formAction} className="mt-5 space-y-4" noValidate>
        <Feedback state={state} />

        <FormField
          label="Full name"
          name="name"
          autoComplete="name"
          defaultValue={kept?.name ?? defaultName}
          required
          error={errors?.name}
        />

        <FormField
          label="Phone (optional)"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={kept?.phone ?? defaultPhone}
          error={errors?.phone}
        />

        <div className="space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <p className="flex h-11 items-center rounded-lg border border-border bg-surface-alt px-3 text-sm text-muted-foreground">
            {email}
          </p>
          <p className="text-xs text-muted-foreground">
            Your email is your sign-in and cannot be changed here. Contact support to
            update it.
          </p>
        </div>

        <Button type="submit" variant="brand" size="pill" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Save changes
        </Button>
      </form>
    </section>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-semibold text-foreground">Password</h2>
      <p className="text-body mt-1">
        Choose something you don&apos;t use anywhere else.
      </p>

      <form action={formAction} className="mt-5 space-y-4" noValidate>
        <Feedback state={state} />

        <FormField
          label="Current password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          error={errors?.currentPassword}
        />

        <FormField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
          error={errors?.password}
        />

        <FormField
          label="Confirm new password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          error={errors?.confirmPassword}
        />

        <Button type="submit" variant="brand" size="pill" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Update password
        </Button>
      </form>
    </section>
  );
}
