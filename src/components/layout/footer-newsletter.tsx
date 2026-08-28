"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";

/**
 * Newsletter signup in the footer. Deliberately minimal: one field, one action,
 * and no modal or interstitial anywhere in the storefront.
 *
 * Sits on the dark purple footer, so the field and submit are inverted — a
 * white submit on purple rather than the usual purple-on-white primary.
 */
export function FooterNewsletter() {
  const [state, formAction, pending] = useActionState(subscribeToNewsletter, null);

  return (
    <div className="lg:pl-10">
      <h2 className="font-display text-2xl leading-tight text-white sm:text-[1.75rem]">
        Stay in the loop
      </h2>
      <p className="mt-2 max-w-md text-[0.9375rem] leading-[1.75] text-white/70">
        New collections, limited pieces and the occasional look behind the work.
      </p>

      {state?.ok ? (
        <p
          role="status"
          className="mt-6 flex items-center gap-2 border border-white/25 bg-white/10 px-4 py-3 text-sm text-white"
        >
          <Check className="size-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      ) : (
        <form action={formAction} className="mt-6 max-w-md" noValidate>
          <Label htmlFor="footer-email" className="sr-only">
            Email address
          </Label>

          <div className="flex gap-2">
            <Input
              id="footer-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Email address"
              required
              aria-invalid={Boolean(state && !state.ok && state.fieldErrors?.email)}
              aria-describedby={
                state && !state.ok && state.fieldErrors?.email
                  ? "footer-email-error"
                  : undefined
              }
              className="h-12 flex-1 rounded-xs border-white/25 bg-white/5 text-white placeholder:text-white/50"
            />
            <Button
              type="submit"
              size="pill"
              disabled={pending}
              className="label-caps rounded-xs bg-white text-brand-700 hover:bg-royal-300 hover:text-brand-800"
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Join Meemi Art
            </Button>
          </div>

          {state && !state.ok && (
            <p id="footer-email-error" role="alert" className="mt-2 text-sm text-royal-200">
              {state.fieldErrors?.email ?? state.error}
            </p>
          )}

          <p className="mt-3 text-xs text-white/55">
            Unsubscribe any time. Read our{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 transition-colors hover:text-white"
            >
              privacy policy
            </Link>
            .
          </p>
        </form>
      )}
    </div>
  );
}
