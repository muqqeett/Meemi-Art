"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, AlertCircle, ShieldCheck, Download, RefreshCw } from "lucide-react";

import { Label } from "@/components/ui/label";
import { plumButtonClass } from "@/components/ui/plum-button";
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
 * Plum Studio input: 48px, 12px radius, a 1.5px outline that turns violet on
 * focus and red when invalid. 16px text, so a phone does not zoom on focus.
 */
const FIELD =
  "pl-focus font-figtree h-12 w-full rounded-[12px] border-[1.5px] border-pl-line-strong bg-pl-surface px-3.5 text-base text-pl-text transition-colors placeholder:text-pl-muted focus-visible:border-plum-500 aria-invalid:border-destructive";

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
      <Label htmlFor={htmlFor} className="text-[15px] leading-[22px] font-bold text-pl-text">
        {label}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-[13px] leading-[18px] font-medium text-pl-muted">{hint}</p>
      )}
      {error && (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="text-[13px] leading-[18px] font-bold text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** A numbered section of the form: a violet disc, then a Bricolage title. */
function Panel({
  step,
  title,
  lead,
  children,
}: {
  step: number;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-pl-line bg-pl-surface p-5 shadow-pl-sm sm:p-6">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-plum-100 text-sm leading-[22px] font-bold text-plum-500"
        >
          {step}
        </span>
        <h2 className="pl-h3">{title}</h2>
      </div>
      {lead && <p className="mt-2 text-sm leading-[22px] text-pl-muted">{lead}</p>}
      {children}
    </section>
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
 *
 * Presentation only. The submit handler, the server action it calls, the
 * validation schema, the duplicate-submit guard and the Paddle hand-off are
 * exactly what they were; the totals shown are the server's, read from `cart`.
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
    <div className="font-figtree rounded-[20px] border border-pl-line bg-pl-surface p-5 shadow-pl-sm sm:p-6">
      <h2 className="pl-h3">Order summary</h2>
      <p className="mt-1 text-[13px] leading-[18px] font-medium text-pl-muted">
        {itemCount} {itemCount === 1 ? "digital item" : "digital items"} · instant download
      </p>

      <ul className="mt-5 mb-5 divide-y divide-pl-line border-y border-pl-line">
        {cart.lines.map((line) => (
          <li key={line.id} className="flex items-start gap-3 py-3.5">
            <span className="relative size-16 shrink-0 overflow-hidden rounded-[12px] bg-pl-tint-crochet">
              {line.imageUrl && (
                <Image
                  src={line.imageUrl}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-contain p-1.5"
                />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base leading-[22px] font-bold tracking-[-0.005em] text-pl-text">
                {line.name}
              </span>
              <span className="text-[13px] leading-[18px] font-medium text-pl-muted">
                Digital download{line.quantity > 1 ? ` · Qty ${line.quantity}` : ""}
              </span>
            </span>
            <span className="pl-display pl-price shrink-0 tabular-nums">
              {formatMoney(line.lineTotalCents)}
            </span>
          </li>
        ))}
      </ul>

      <CouponForm variant="plum" appliedCode={cart.coupon?.code ?? null} />

      {/* The plum variant never draws its own card or heading, so `bare` is only
          kept for symmetry with the cart page. */}
      <OrderSummary
        variant="plum"
        bare
        totals={cart.totals}
        coupon={cart.coupon}
        className="mt-5 border-t border-pl-line pt-5"
      />

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className={plumButtonClass({ style: "buy", size: "lg", className: "mt-6 w-full" })}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Lock className="size-5" aria-hidden />
        )}
        {redirecting
          ? "Opening secure payment…"
          : `Continue to payment · ${formatMoney(cart.totals.totalCents)}`}
      </button>

      <p className="mt-3 text-center text-[13px] leading-[18px] font-medium text-pl-muted">
        You&apos;ll review the final amount before paying.
      </p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="font-figtree">
      {/* `lg:items-start` so the summary can stick without the column
          stretching; `min-w-0` because a grid item's automatic minimum is its
          min-content width, which a long product name would otherwise use to
          hold the track open. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-10">
        <div className="min-w-0 space-y-6">
          {formError && (
            <div
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="flex items-start gap-2.5 rounded-[16px] border border-destructive/30 bg-destructive/5 px-4 py-3.5 text-sm leading-[22px] font-bold text-destructive outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-destructive"
            >
              <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
              <span>{formError}</span>
            </div>
          )}

          <Panel
            step={1}
            title="Your details"
            lead="Your receipt and download links go to this address."
          >
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Name" htmlFor="customerName" error={errors.customerName?.message}>
                <input
                  id="customerName"
                  className={FIELD}
                  autoComplete="name"
                  aria-invalid={Boolean(errors.customerName)}
                  aria-describedby={errors.customerName ? "customerName-error" : undefined}
                  {...register("customerName")}
                />
              </Field>

              <Field label="Email" htmlFor="email" error={errors.email?.message}>
                <input
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
                <input id="notes" className={FIELD} {...register("notes")} />
              </Field>
            </div>
          </Panel>

          <Panel step={2} title="Payment">
            {/* One method, so this is a statement rather than a choice. A radio
                group with a single option is a control that cannot be used. */}
            <div className="mt-5 flex items-start gap-3 rounded-[16px] bg-plum-100/60 px-4 py-4">
              <ShieldCheck className="mt-0.5 size-6 shrink-0 text-plum-500" aria-hidden />
              <div className="min-w-0">
                <p className="text-base leading-[22px] font-bold tracking-[-0.005em] text-pl-text">
                  Card payment via {providerLabel}
                </p>
                <p className="mt-1 text-sm leading-[22px] text-pl-muted">
                  Payment is completed here on this page. Card details are entered
                  directly with {providerLabel} and never reach this site.
                </p>
                {isTestMode && (
                  <p className="mt-3 inline-flex rounded-full bg-pl-tint-templates px-3 py-1 text-[13px] leading-[18px] font-bold text-pl-text">
                    Test mode — no real money will be taken.
                  </p>
                )}
              </div>
            </div>

            <ul className="mt-5 space-y-2.5 text-sm leading-[22px] text-pl-muted">
              <li className="flex items-start gap-2.5">
                <Download className="mt-0.5 size-4 shrink-0 text-plum-500" aria-hidden />
                Files are available in your account the moment payment is confirmed.
              </li>
              <li className="flex items-start gap-2.5">
                <Lock className="mt-0.5 size-4 shrink-0 text-plum-500" aria-hidden />
                We never see or store your card details.
              </li>
              <li className="flex items-start gap-2.5">
                <RefreshCw className="mt-0.5 size-4 shrink-0 text-plum-500" aria-hidden />
                Nothing is charged until you confirm on the next step.
              </li>
            </ul>
          </Panel>
        </div>

        {/* Below `lg` this renders after the details, which puts the total and
            the CTA at the end of the reading order where the decision is
            actually made. Above `lg` it sticks alongside. */}
        <aside className="min-w-0 lg:sticky lg:top-24" aria-label="Order summary">
          {summary}
        </aside>
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
