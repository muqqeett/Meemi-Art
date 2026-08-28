"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, AlertCircle, ShieldCheck, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrderSummary } from "@/components/cart/order-summary";
import { CouponForm } from "@/components/cart/coupon-form";
import { placeOrder } from "@/lib/actions/checkout";
import { loadPaddle } from "@/lib/payments/paddle-client";
import {
  checkoutSchema,
  type CheckoutInput,
  type CheckoutFormValues,
} from "@/lib/validations/commerce";
import { cn } from "@/lib/utils";
import type { CartView } from "@/lib/cart/cart-service";

type CheckoutFormProps = {
  cart: CartView;
  defaultEmail: string;
  defaultName: string;
  /** Shown so the customer knows where they are about to be sent. */
  providerLabel: string;
  isTestMode: boolean;
};

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Digital checkout.
 *
 * Three fields, because three is all a downloadable file needs: who you are,
 * where the receipt goes, and anything you want to tell us. No address, no
 * delivery method, no card fields — the instrument is captured by the payment
 * provider on its own domain, so there is deliberately nowhere here to type a
 * card number.
 *
 * Submitting does not complete a purchase. It creates a pending order and
 * hands back a hosted checkout URL; the order only becomes real when the
 * provider's signed webhook arrives. That is why the button says "Continue to
 * payment" rather than "Pay".
 */
export function CheckoutForm({
  cart,
  defaultEmail,
  defaultName,
  providerLabel,
  isTestMode,
}: CheckoutFormProps) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CheckoutFormValues, unknown, CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: defaultName,
      email: defaultEmail,
      notes: "",
    },
  });

  function onSubmit(values: CheckoutInput) {
    setFormError(null);

    startTransition(async () => {
      const result = await placeOrder(values);

      if (!result.ok) {
        setFormError(result.error);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as keyof CheckoutFormValues, { message });
        }
        return;
      }

      setRedirecting(true);

      // Paddle: open the overlay on the transaction the server just priced.
      // The browser is given a transaction id and nothing else — it cannot
      // alter what is being bought or what it costs, and reaching the success
      // callback grants nothing. Access is still only ever created by the
      // signed webhook.
      if (result.provider === "paddle") {
        const paddle = await loadPaddle();
        if (paddle) {
          paddle.Checkout.open({
            transactionId: result.providerTransactionId,
            settings: { displayMode: "overlay", theme: "light" },
          });
          // The overlay is now in charge. Stay on the page: closing it must
          // leave the customer where they were, with the order still pending
          // and retryable.
          setRedirecting(false);
          return;
        }
        // Paddle.js could not load — fall through to the hosted page.
      }

      // A full navigation, not a router push: the destination is the
      // provider's own domain.
      if (!result.checkoutUrl) {
        setRedirecting(false);
        setFormError("We couldn't open the payment window. Please try again.");
        return;
      }
      window.location.assign(result.checkoutUrl);
    });
  }

  const busy = pending || redirecting;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-14"
    >
      <div className="min-w-0 space-y-8">
        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{formError}</span>
          </div>
        )}

        <section>
          <h2 className="heading-sub">Your details</h2>
          <p className="text-body mt-1">
            Your receipt and download links go to this address.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="Name" htmlFor="customerName" error={errors.customerName?.message}>
              <Input
                id="customerName"
                autoComplete="name"
                aria-invalid={Boolean(errors.customerName)}
                {...register("customerName")}
              />
            </Field>

            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
            </Field>
          </div>

          <div className="mt-5">
            <Field
              label="Order notes (optional)"
              htmlFor="notes"
              hint="Anything you'd like us to know."
              error={errors.notes?.message}
            >
              <Input id="notes" {...register("notes")} />
            </Field>
          </div>
        </section>

        <section className="border-t border-border pt-8">
          <h2 className="heading-sub">Payment</h2>

          {/* One method, so this is a statement rather than a choice. A radio
              group with a single option is a control that cannot be used. */}
          <div className="mt-5 flex items-start gap-3 rounded-xs border border-brand-700/35 bg-brand-50/60 px-4 py-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Online payment via {providerLabel}
              </p>
              <p className="text-body mt-1 text-xs">
                You&apos;ll be taken to {providerLabel} to pay securely. Card details are
                entered there and never reach this site.
              </p>
              {isTestMode && (
                <p className="mt-2 text-xs font-medium text-warning">
                  Test mode — no real money will be taken.
                </p>
              )}
            </div>
          </div>

          <ul className="text-body mt-5 space-y-2 text-xs">
            <li className="flex items-center gap-2">
              <Download className="size-3.5 shrink-0 text-brand-500" aria-hidden />
              Files are available in your account the moment payment is confirmed.
            </li>
            <li className="flex items-center gap-2">
              <Lock className="size-3.5 shrink-0 text-brand-500" aria-hidden />
              We never see or store your card details.
            </li>
          </ul>
        </section>
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="heading-sub mb-4">Your order</h2>

          <ul className="mb-4 space-y-3 border-b border-border pb-4">
            {cart.lines.map((line) => (
              <li key={line.id} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{line.name}</span>
                  {line.quantity > 1 && (
                    <span className="text-xs text-muted-foreground">
                      Qty {line.quantity}
                    </span>
                  )}
                </span>
                <span className="price shrink-0 text-sm">
                  {(line.lineTotalCents / 100).toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                  })}
                </span>
              </li>
            ))}
          </ul>

          <CouponForm appliedCode={cart.coupon?.code ?? null} />

          <OrderSummary totals={cart.totals} coupon={cart.coupon} className="mt-4" />

          <Button
            type="submit"
            variant="brand"
            size="pillLg"
            disabled={busy}
            className={cn("mt-6 w-full")}
          >
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {redirecting ? "Taking you to payment…" : "Continue to payment"}
          </Button>

          <p className="text-body mt-3 text-center text-xs">
            You&apos;ll review the final amount before paying.
          </p>
        </div>
      </aside>
    </form>
  );
}
