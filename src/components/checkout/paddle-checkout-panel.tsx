"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Move focus into the dialog so keyboard and screen-reader users land here
    // rather than being left behind on the page underneath. Effects run after
    // the portal has been committed to the DOM, so the ref is populated.
    closeButton.current?.focus();

    // Lock the page behind the dialog. Without this the storefront scrolls
    // under the payment sheet on touch, which on a small screen reads as the
    // form sliding away mid-payment.
    //
    // The lock goes on `html` as well as `body`: the root element carries
    // `h-full`, which makes `documentElement` the scrolling box, so locking
    // `body` alone did nothing — measured scrolling 400px behind an open
    // sheet.
    const root = document.documentElement;
    const previous = { root: root.style.overflow, body: document.body.style.overflow };
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      root.style.overflow = previous.root;
      document.body.style.overflow = previous.body;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Escape closes, matching every other dialog on the site. The order stays
      // pending and retryable — closing never means "paid".
      if (event.key === "Escape") {
        onClose();
        return;
      }

      // Keep Tab inside the payment environment. Only our own controls are
      // trapped — once focus enters Paddle's iframe the browser hands tabbing
      // to that document, which is Paddle's to manage, not ours.
      if (event.key !== "Tab" || !surface.current) return;

      const focusable = surface.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  const surfaceMarkup = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Secure payment"
      /* A full-height sheet on phones — a floating card with the storefront
         showing above and below it leaves the card fields feeling detached
         mid-payment. From `sm` up it becomes a centred dialog on a scrim deep
         enough that the shop behind reads as dimmed context, not as a page the
         payment is sitting inside. */
      className="fixed inset-0 z-[60] flex justify-center overflow-y-auto bg-ink/70 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <div
        ref={surface}
        /* From `sm` up the sheet is capped to the viewport and scrolls its own
           body, so it stays centred and never runs off the bottom of a short
           laptop screen — the reserved 460px Paddle frame alone makes the
           natural height 922px, which overflowed a 900px viewport. On phones
           it stays a full-height sheet and the page itself scrolls. */
        className="flex min-h-dvh w-full flex-col bg-card pb-[env(safe-area-inset-bottom)] sm:my-auto sm:max-h-[calc(100dvh-3rem)] sm:min-h-0 sm:max-w-[480px] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-border sm:pb-0 sm:shadow-2xl"
      >
        {/* Sticky on the sheet so the amount and the way out stay reachable
            while Paddle's frame scrolls under a mobile keyboard. */}
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-card px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 sm:static sm:rounded-t-2xl sm:pt-5">
          <div className="min-w-0">
            <p className="label-caps flex items-center gap-1.5 text-brand-600">
              <Lock className="size-3" aria-hidden />
              Secure payment
            </p>
            <h2 className="heading-sub mt-1.5">Card details</h2>
            <p className="text-body mt-0.5 text-xs">Order {orderNumber}</p>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="-m-1.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-alt hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:size-9"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
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
                      className="object-contain"
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

          {/* The amount is the one number that must never be hunted for on a
              payment screen, so it gets its own panel rather than a row. */}
          <div className="rounded-xl bg-surface-alt/70 px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-muted-foreground">
                Amount to pay
              </span>
              <span className="text-2xl font-semibold text-foreground tabular-nums">
                {formatMoney(totalCents)}
              </span>
            </div>
            <p className="text-body mt-1.5 text-xs">
              Any local sales tax is added by Paddle at the payment step.
            </p>
          </div>

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

  /**
   * Rendered into `document.body`, and this is the whole reason the payment
   * screen looked wedged between the header and the footer.
   *
   * `PageTransition` wraps every route in `.page-enter`, whose entrance
   * animation uses `animation-fill-mode: both`. When it finishes it does not
   * return to `transform: none` — it holds `matrix(1, 0, 0, 1, 0, 0)`, an
   * identity transform. Any computed transform other than the keyword `none`
   * makes an element the containing block for its `position: fixed`
   * descendants, so `fixed inset-0` here resolved against the page wrapper
   * rather than the viewport: measured at top 116, height 571 on a 900px
   * screen. The overlay could not cover the chrome because it was living
   * inside it.
   *
   * Portalling to `body` steps outside that ancestor, so `fixed` means the
   * viewport again. The alternative — dropping the transform from
   * `.page-enter` — would remove the site-wide page entrance to fix one
   * dialog, which is the wrong trade.
   */
  // The panel only ever renders after a click, so it never reaches the server
  // renderer; the guard is belt-and-braces against a future caller.
  if (typeof document === "undefined") return null;
  return createPortal(surfaceMarkup, document.body);
}
