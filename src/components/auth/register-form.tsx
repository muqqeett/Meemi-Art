"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

import { FormField } from "@/components/auth/form-field";
import { AuthSwitch } from "@/components/auth/plum-auth";
import { plumAlert, plumLink, plumPrimary } from "@/components/auth/plum-auth-styles";
import { registerAction } from "@/lib/actions/auth";

/**
 * Sign-up form — presentation only. Field names, the hidden `callbackUrl` and
 * the way `registerAction` returns errors and the values to keep are unchanged.
 */
export function RegisterForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "";
  const [state, formAction, pending] = useActionState(registerAction, null);
  const kept = state && !state.ok ? state.values : undefined;

  const emailError = state && !state.ok ? state.fieldErrors?.email : undefined;
  // `registerAction` reports a taken address as an email field error. When that
  // is what happened, offer the way forward the design's "Email already used"
  // frame offers — log in instead — rather than leaving only the message.
  const emailTaken = Boolean(emailError && /already exists/i.test(emailError));

  const loginHref = callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/login";

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      {state && !state.ok && !state.fieldErrors && (
        <div role="alert" className={plumAlert}>
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <FormField
        variant="plum"
        label="Full name"
        name="name"
        placeholder="Sara Khan"
        autoComplete="name"
        required
        defaultValue={kept?.name}
        error={state && !state.ok ? state.fieldErrors?.name : undefined}
      />

      <div className="flex flex-col gap-2">
        <FormField
          variant="plum"
          label="Email"
          name="email"
          type="email"
          placeholder="name@mail.com"
          autoComplete="email"
          required
          defaultValue={kept?.email}
          error={emailError}
        />
        {emailTaken && (
          <Link href={loginHref} className={`${plumLink} w-fit text-[15px] leading-[22px]`}>
            Log in instead
          </Link>
        )}
      </div>

      <FormField
        variant="plum"
        label="Password"
        name="password"
        type="password"
        placeholder="Choose a password"
        autoComplete="new-password"
        required
        hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
        error={state && !state.ok ? state.fieldErrors?.password : undefined}
      />

      <FormField
        variant="plum"
        label="Confirm password"
        name="confirmPassword"
        type="password"
        placeholder="Type it again"
        autoComplete="new-password"
        required
        error={state && !state.ok ? state.fieldErrors?.confirmPassword : undefined}
      />

      <button type="submit" className={plumPrimary} disabled={pending} aria-busy={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {pending ? "Creating your account…" : "Create account"}
      </button>

      <AuthSwitch
        prompt="Already have an account?"
        linkLabel="Log in"
        href={loginHref}
        note={
          <>
            By creating an account you agree to our{" "}
            <Link href="/terms" className="pl-focus rounded-xs font-bold underline hover:text-pl-text">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="pl-focus rounded-xs font-bold underline hover:text-pl-text">
              privacy policy
            </Link>
            .
          </>
        }
      />
    </form>
  );
}
