"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

import { FormField } from "@/components/auth/form-field";
import { AuthSwitch } from "@/components/auth/plum-auth";
import { plumAlert, plumPrimary } from "@/components/auth/plum-auth-styles";
import { loginAction } from "@/lib/actions/auth";

/**
 * Log-in form — presentation only. The action, its field names, the hidden
 * `callbackUrl` and the way errors and the typed email come back are exactly
 * what `loginAction` expects; only how they are drawn has changed.
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "";
  const [state, formAction, pending] = useActionState(loginAction, null);

  // The other screen keeps the destination, so a shopper bounced here from
  // checkout who decides to create an account still lands back there. The
  // server validates the value again (`safeCallback`); this only carries it.
  const registerHref = callbackUrl
    ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/register";

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      {state && !state.ok && (
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

      <FormField
        variant="plum"
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
            className="pl-focus rounded-xs text-[13px] leading-[18px] font-bold text-plum-500 transition-colors hover:text-plum-800 hover:underline"
          >
            Forgot password?
          </Link>
        }
      />

      <button type="submit" className={plumPrimary} disabled={pending} aria-busy={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {pending ? "Logging in…" : "Log in"}
      </button>

      <AuthSwitch
        prompt="New to Meemi Art?"
        linkLabel="Create an account"
        href={registerHref}
        note="An account keeps every file you buy in your library, ready to download again."
      />
    </form>
  );
}
