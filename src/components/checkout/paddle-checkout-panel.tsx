"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Lock, ShieldCheck, X, AlertCircle, CheckCircle2 } from "lucide-react";

import { formatMoney } from "@/lib/money";
import {
  loadPaddle,
  onPaddleEvent,
  PADDLE_FRAME_CLASS,
} from "@/lib/payments/paddle-client";

/**
 * On-site checkout: MeemiArt chrome around Paddle's own payment frame.
 *
 * ── What Paddle actually permits ────────────────────────────────────────────
 *
 * Paddle.js exposes exactly two display modes — `'inline' | 'overlay'` (see
 * `DisplayMode` in @paddle/paddle-js). There is no Elements-style API: no
 * card-number, expiry or CVC components to place in our own form, and no
 * tokenisation call we could drive from a custom field. Nothing in the package
 * matches /cardNumber|hostedField|cvc/.
 *
 * So a genuinely custom card form is not possible with Paddle, and building one
 * would mean posting raw PAN through our server — which is precisely what must
 * never happen. `inline` is the closest supported on-site experience: Paddle
 * renders its checkout into a container we provide, inside an iframe on
 * Paddle's origin. The card fields live in that iframe, so card data goes
 * browser → Paddle and never touches this application, its logs or its
 * database. Everything outside the frame is ours to style.
 *
 * ── What this component is trusted with ─────────────────────────────────────
 *
 * A transaction id, and nothing else. The order was priced server-side from
 * the catalogue price id before this mounted, so there is no amount here to
 * tamper with. `checkout.completed` is treated as "submitted", never as
 * "paid": access is granted only by the signed webhook, so the success state
 * says the payment is being confirmed rather than claiming it succeeded.
 */

type Line = { name: string; imageUrl: string | null; quantity: number };

type Phase = "loading" | "ready" | "submitted" | "failed";

export function PaddleCheckoutPanel({
  transactionId,
  orderNumber,
  totalCents,
  lines,
  onClose,
}: {
  transactionId: string;
  orderNumber: string;
  totalCents: number;
  lines: Line[];
  /** Closing must leave the order pending and retryable — never paid. */
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mounted = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Move focus into the dialog so keyboard and screen-reader users land here
    // rather than being left behind on the page underneath.
    closeButton.current?.focus();
  }, []);

  useEffect(() => {
    const unsubscribe = onPaddleEvent((event) => {
      switch (event.name) {
        case "checkout.loaded":
          setPhase("ready");
          break;
        case "checkout.completed":
          // Submitted, not confirmed. The webhook decides.
          setPhase("submitted");
          break;
        case "checkout.payment.failed":
        case "checkout.error":
          // Paddle's own text can be technical and can quote the request, so
          // the customer gets a plain sentence and nothing else.
          setPhase("failed");
          setErrorMessage(null);
          break;
        default:
          break;
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    let cancelled = false;

    void (async () => {
      const paddle = await loadPaddle();
      if (cancelled) return;

      if (!paddle) {
        setPhase("failed");
        setErrorMessage("We couldn't load the payment form. Please try again.");
        return;
      }

      paddle.Checkout.open({
        transactionId,
        settings: {
          displayMode: "inline",
          // Paddle finds its mount point by class name.
          frameTarget: PADDLE_FRAME_CLASS,
          frameInitialHeight: 460,
          // Paddle requires width to be set here; the wrapper handles the rest.
          frameStyle: "width:100%; min-width:312px; background-color:transparent; border:none;",
          theme: "light",
          variant: "one-page",
          showAddDiscounts: false,
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Complete your purchase"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:items-center"
    >
      <div className="my-auto w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="heading-sub">Complete your purchase</h2>
            <p className="text-body mt-0.5 text-xs">Order {orderNumber}</p>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-surface-alt hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="space-y-4 p-5">
          <ul className="space-y-3">
            {lines.map((line) => (
              <li key={line.name} className="flex items-center gap-3">
                <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-alt">
                  {line.imageUrl && (
                    <Image
                      src={line.imageUrl}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {line.name}
                  </span>
                  <span className="text-body block text-xs">
                    Digital download{line.quantity > 1 ? ` · ${line.quantity}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="text-lg font-semibold text-foreground">
              {formatMoney(totalCents)}
            </span>
          </div>
          <p className="text-body text-xs">
            Tax is calculated by Paddle at the payment step and may be added to this
            total.
          </p>

          {phase === "submitted" ? (
            <div
              role="status"
              className="rounded-xl border border-success/30 bg-success/5 p-5 text-center"
            >
              <CheckCircle2 className="text-success mx-auto size-8" aria-hidden />
              <p className="mt-2 font-semibold text-foreground">
                Payment submitted successfully
              </p>
              <p className="text-body mt-1 text-sm">
                We&rsquo;re confirming your payment. Your download becomes available as
                soon as it&rsquo;s confirmed — usually a few seconds.
              </p>
              <a
                href={`/orders/${orderNumber}?from=payment`}
                className="mt-4 inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                View your order
              </a>
            </div>
          ) : (
            <>
              {phase === "failed" && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {errorMessage ??
                      "Payment couldn't be completed. Please check your payment details and try again."}
                  </span>
                </div>
              )}

              {/* Paddle mounts its iframe here. Everything inside belongs to
                  Paddle — the card fields never exist in this document. */}
              <div className="relative min-h-[460px]">
                {phase === "loading" && (
                  <div className="text-body absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm">
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                    Loading secure payment form…
                  </div>
                )}
                <div className={PADDLE_FRAME_CLASS} />
              </div>
            </>
          )}

          <ul className="text-body space-y-1.5 border-t border-border pt-4 text-xs">
            <li className="flex items-center gap-2">
              <Lock className="size-3.5 shrink-0 text-brand-500" aria-hidden />
              Card details are entered directly with Paddle. They never reach Meemi Art.
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 shrink-0 text-brand-500" aria-hidden />
              Paddle is the merchant of record and appears on your statement.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
