"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, AlertCircle, ShieldCheck, Download, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrderSummary } from "@/components/cart/order-summary";
import { CouponForm } from "@/components/cart/coupon-form";
import { placeOrder } from "@/lib/actions/checkout";
import { PaddleCheckoutPanel } from "@/components/checkout/paddle-checkout-panel";
import { formatMoney } from "@/lib/money";
import {
  checkoutSchema,
  type CheckoutInput,
  type CheckoutFormValues,
} from "@/lib/validations/commerce";
import type { CartView } from "@/lib/cart/cart-service";

type CheckoutFormProps = {
  cart: CartView;
  defaultEmail: string;
  defaultName: string;
  /** Shown so the customer knows who takes the card. */
  providerLabel: string;
  isTestMode: boolean;
};

/**
 * Checkout fields are taller than the app's default input.
 *
 * `Input` is `h-11 sm:h-8` — 32px from `sm` up, which is right for an admin
 * table and too dense for the one form on the site where the customer is being
 * asked for money. Overridden here rather than in the primitive so no other
 * screen moves.
 */
const FIELD = "h-12 rounded-xl px-3.5 text-base sm:h-12 sm:text-sm";

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
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-[0.8125rem] font-medium">
        {label}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-destructive">
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
 * returns a transaction to pay for; the order only becomes real when the
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
  /** Set once the server has created a Paddle transaction to pay for. */
  const [checkout, setCheckout] = useState<{
    transactionId: string;
    orderNumber: string;
  } | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

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

  const busy = pending || redirecting;

  // Move the reader to the explanation rather than leaving them looking at a
  // button that appears to have done nothing. In an effect rather than in the
  // submit handler so the ref is never touched from a closure built during
  // render.
  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  function onSubmit(values: CheckoutInput) {
    // A second submit while the first is in flight would create a second
    // pending order for the same bag.
    if (busy) return;

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

      // Paddle: open checkout on the transaction the server just priced. The
      // browser is given a transaction id and nothing else — it cannot alter
      // what is being bought or what it costs, and reaching the success
      // callback grants nothing. Access is still only ever created by the
      // signed webhook.
      if (result.provider === "paddle") {
        setCheckout({
          transactionId: result.providerTransactionId,
          orderNumber: result.orderNumber,
        });
        setRedirecting(false);
        return;
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

  const itemCount = cart.lines.reduce((n, line) => n + line.quantity, 0);

  const summary = (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <h2 className="heading-sub mb-1">Order summary</h2>
      <p className="text-body mb-5 text-xs">
        {itemCount} {itemCount === 1 ? "digital item" : "digital items"} · instant download
      </p>

      <ul className="mb-5 space-y-3.5 border-b border-border pb-5">
        {cart.lines.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className="block font-medium text-foreground">{line.name}</span>
              <span className="text-body block text-xs">
                Digital download{line.quantity > 1 ? ` · Qty ${line.quantity}` : ""}
              </span>
            </span>
            <span className="price shrink-0 text-sm tabular-nums">
              {formatMoney(line.lineTotalCents)}
            </span>
          </li>
        ))}
      </ul>

      <CouponForm appliedCode={cart.coupon?.code ?? null} />

      {/* `bare` because this already sits inside a bordered card — without it
          the totals render their own card and a second "Order summary"
          heading inside this one. */}
      <OrderSummary bare totals={cart.totals} coupon={cart.coupon} className="mt-5" />

      <Button
        type="submit"
        variant="brand"
        size="pillLg"
        disabled={busy}
        aria-busy={busy}
        className="mt-6 w-full"
      >
        {busy && <Loader2 className="animate-spin" aria-hidden />}
        {redirecting ? "Opening secure payment…" : "Continue to payment"}
      </Button>

      <p className="text-body mt-3 flex items-center justify-center gap-1.5 text-center text-xs">
        <Lock className="size-3 shrink-0" aria-hidden />
        You&apos;ll review the final amount before paying.
      </p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* `lg:items-start` so the summary can stick without the column
          stretching; `min-w-0` because a grid item's automatic minimum is its
          min-content width, which a long product name would otherwise use to
          hold the track open. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-12">
        <div className="min-w-0 space-y-6">
          {formError && (
            <div
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3.5 text-sm text-destructive outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{formError}</span>
            </div>
          )}

          <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
            <h2 className="heading-sub">Your details</h2>
            <p className="text-body mt-1 text-sm">
              Your receipt and download links go to this address.
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Name" htmlFor="customerName" error={errors.customerName?.message}>
                <Input
                  id="customerName"
                  className={FIELD}
                  autoComplete="name"
                  aria-invalid={Boolean(errors.customerName)}
                  aria-describedby={
                    errors.customerName ? "customerName-error" : undefined
                  }
                  {...register("customerName")}
                />
              </Field>

              <Field label="Email" htmlFor="email" error={errors.email?.message}>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  className={FIELD}
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
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
                <Input id="notes" className={FIELD} {...register("notes")} />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
            <h2 className="heading-sub">Payment</h2>

            {/* One method, so this is a statement rather than a choice. A radio
                group with a single option is a control that cannot be used. */}
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-brand-700/30 bg-brand-50/60 px-4 py-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Card payment via {providerLabel}
                </p>
                <p className="text-body mt-1 text-xs">
                  Payment is completed here on this page. Card details are entered
                  directly with {providerLabel} and never reach this site.
                </p>
                {isTestMode && (
                  <p className="mt-2 text-xs font-medium text-warning">
                    Test mode — no real money will be taken.
                  </p>
                )}
              </div>
            </div>

            <ul className="text-body mt-5 space-y-2.5 text-xs">
              <li className="flex items-start gap-2">
                <Download className="mt-px size-3.5 shrink-0 text-brand-500" aria-hidden />
                Files are available in your account the moment payment is confirmed.
              </li>
              <li className="flex items-start gap-2">
                <Lock className="mt-px size-3.5 shrink-0 text-brand-500" aria-hidden />
                We never see or store your card details.
              </li>
              <li className="flex items-start gap-2">
                <RefreshCw className="mt-px size-3.5 shrink-0 text-brand-500" aria-hidden />
                Nothing is charged until you confirm on the next step.
              </li>
            </ul>
          </section>
        </div>

        {/* Below `lg` this renders after the details, which puts the total and
            the CTA at the end of the reading order where the decision is
            actually made. Above `lg` it sticks alongside. */}
        <aside className="min-w-0 lg:sticky lg:top-24">{summary}</aside>
      </div>

      {/* Paddle's iframe mounts inside this panel, on this page. Rendered only
          after the server has priced the order and returned a transaction id. */}
      {checkout && (
        <PaddleCheckoutPanel
          transactionId={checkout.transactionId}
          orderNumber={checkout.orderNumber}
          totalCents={cart.totals.totalCents}
          lines={cart.lines.map((item) => ({
            name: item.name,
            imageUrl: item.imageUrl,
            quantity: item.quantity,
          }))}
          onClose={() => setCheckout(null)}
        />
      )}
    </form>
  );
}
