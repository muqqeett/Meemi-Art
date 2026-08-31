"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/form-field";
import { loginAction } from "@/lib/actions/auth";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "";
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      {state && !state.ok && (
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
          label="Email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
          defaultValue={state && !state.ok ? state.values?.email : undefined}
          error={state && !state.ok ? state.fieldErrors?.email : undefined}
        />

        {/* The design sits "Forgot？" on the label row rather than under the
            field, which is what keeps the two inputs evenly spaced. */}
        <FormField
          label="Password"
          name="password"
          type="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          error={state && !state.ok ? state.fieldErrors?.password : undefined}
          labelAction={
            <Link
              href="/forgot-password"
              className="text-royal-600 hover:text-royal-700 rounded-xs text-sm font-medium transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500"
            >
              Forgot?
            </Link>
          }
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
          {pending ? "Signing in…" : "Login now"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-royal-600 hover:text-royal-700 rounded-xs font-medium transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500"
          >
            Sign up
          </Link>
        </p>
      </div>
    </form>
  );
}
