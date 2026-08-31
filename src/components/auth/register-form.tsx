"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/form-field";
import { registerAction } from "@/lib/actions/auth";

export function RegisterForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "";
  const [state, formAction, pending] = useActionState(registerAction, null);
  const kept = state && !state.ok ? state.values : undefined;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      {state && !state.ok && !state.fieldErrors && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <div className="space-y-5">
      <FormField
        label="Full name"
        name="name"
        placeholder="Alex Morgan"
        autoComplete="name"
        required
        defaultValue={kept?.name}
        error={state && !state.ok ? state.fieldErrors?.name : undefined}
      />

      <FormField
        label="Email"
        name="email"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        required
        defaultValue={kept?.email}
        error={state && !state.ok ? state.fieldErrors?.email : undefined}
      />

      <FormField
        label="Password"
        name="password"
        type="password"
        placeholder="••••••••"
        autoComplete="new-password"
        required
        hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
        error={state && !state.ok ? state.fieldErrors?.password : undefined}
      />

      <FormField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        placeholder="••••••••"
        autoComplete="new-password"
        required
          error={state && !state.ok ? state.fieldErrors?.confirmPassword : undefined}
        />
      </div>

      <div className="flex flex-col items-center gap-4">
        <Button
          type="submit"
          variant="brand"
          className="h-12 w-full rounded-lg text-base font-semibold tracking-normal normal-case"
          disabled={pending}
          aria-busy={pending}
        >
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? "Creating your account…" : "Create account"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-royal-600 hover:text-royal-700 rounded-xs font-medium transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500"
          >
            Log in
          </Link>
        </p>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
