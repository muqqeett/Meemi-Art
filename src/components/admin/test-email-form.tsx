"use client";

import { useActionState } from "react";
import { Loader2, Check, AlertCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendTestEmail } from "@/lib/actions/admin/email";

/**
 * Sends a test email from admin settings.
 *
 * Disabled when no provider is configured — offering a button that can only
 * fail wastes a click and teaches the operator to distrust the screen. The
 * reason is stated instead.
 */
export function TestEmailForm({
  configured,
  defaultEmail,
}: {
  configured: boolean;
  defaultEmail: string;
}) {
  const [state, formAction, pending] = useActionState(sendTestEmail, null);

  return (
    <form action={formAction} className="mt-4 border-t border-border pt-4" noValidate>
      <Label htmlFor="test-email" className="text-sm font-medium text-foreground">
        Send a test email
      </Label>
      <p className="text-body mt-1 text-xs">
        {configured
          ? "Confirms mail leaves under the right sender. Contains no tokens or links."
          : "Available once RESEND_API_KEY and EMAIL_FROM are set."}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          id="test-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          defaultValue={defaultEmail}
          required
          disabled={!configured}
          aria-invalid={Boolean(state && !state.ok)}
          className="h-10 min-w-56 flex-1"
        />
        <Button type="submit" size="sm" className="h-10" disabled={!configured || pending}>
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Send aria-hidden />
          )}
          Send test email
        </Button>
      </div>

      {state && (
        <div
          role={state.ok ? "status" : "alert"}
          className={`mt-3 rounded-lg border p-3 text-sm ${
            state.ok
              ? "border-success/30 bg-success/5"
              : "border-destructive/30 bg-destructive/5"
          }`}
        >
          <p
            className={`flex items-start gap-2 ${
              state.ok ? "text-success" : "text-destructive"
            }`}
          >
            {state.ok ? (
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <span>{state.ok ? state.message : state.error}</span>
          </p>

          {/* Resend's message id, so a send can be found in their dashboard. */}
          {state.ok && state.providerId && (
            <p className="text-body mt-2 text-xs">
              Resend message ID:{" "}
              <span className="font-mono break-all text-foreground">
                {state.providerId}
              </span>
            </p>
          )}

          {/* The provider's own words. This is the whole point of the page:
              "domain not verified" is a different problem from a bad key, and
              only Resend can tell you which. */}
          {!state.ok && state.providerError && (
            <p className="text-body mt-2 text-xs">
              Resend said:{" "}
              <span className="font-mono break-all text-foreground">
                {state.providerError}
              </span>
            </p>
          )}
        </div>
      )}
    </form>
  );
}
