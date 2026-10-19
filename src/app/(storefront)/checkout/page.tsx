import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getCartWithCoupon } from "@/lib/cart/cart-service";
import { requireUser } from "@/lib/auth-guards";
import { getPaymentProvider } from "@/lib/payments";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

/**
 * Checkout requires an account.
 *
 * A download has to be authorised against a signed-in user, so a guest
 * purchase would produce a paid file that nobody could ever collect. Sending
 * them to sign in with a callback is kinder than letting them fill a form and
 * discover this at the end.
 *
 * ── Why this page composes itself differently from the rest of the site ─────
 *
 * Every other storefront page is a band of content. That is right for a
 * catalogue and wrong here: the payment step has to read as the thing the page
 * is for, not as one more section of a long page. So this route claims the
 * height `main` hands down (`data-fill`) and lays itself out as a column — a
 * context bar, then the workspace — in the Plum Studio style: a violet page
 * ground, a Bricolage title, and two panels beside a sticky summary.
 *
 * Presentation only. The sign-in guard, the server-priced cart, the empty-cart
 * redirect and the payment provider lookup are unchanged.
 */
export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const cart = await getCartWithCoupon();

  // Nothing to check out — send them back rather than rendering a dead form.
  if (cart.lines.length === 0) redirect("/cart");

  const provider = getPaymentProvider();

  return (
    <div data-fill className="font-figtree flex min-h-full flex-col bg-pl-page text-pl-text">
      {/* Context bar. The header above says "Meemi Art"; this says "you are
          paying now, and here is the way back". */}
      <div className="border-b border-pl-line bg-pl-surface">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-8">
          <Link
            href="/cart"
            className="pl-focus inline-flex h-11 items-center gap-2 rounded-full pr-3 text-[15px] leading-[18px] font-bold text-pl-text transition-colors hover:text-plum-500"
          >
            <ArrowLeft className="size-5" aria-hidden />
            Back to bag
          </Link>

          <p className="inline-flex items-center gap-1.5 text-[13px] leading-[18px] font-bold text-pl-muted">
            <Lock className="size-4 text-plum-500" aria-hidden />
            Secure checkout
          </p>
        </div>
      </div>

      {/* The flexible row: it absorbs the leftover viewport height, so the
          footer sits at the bottom on a short screen and scrolls normally on a
          tall order. */}
      <div className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-[1120px] px-4 pt-8 pb-16 sm:px-8 lg:pt-12 lg:pb-20">
          <header className="mb-8 lg:mb-10">
            <h1 className="pl-display text-[40px] leading-[44px] tracking-[-0.03em] sm:text-[52px] sm:leading-[56px]">
              Checkout
            </h1>
            <p className="mt-3 max-w-[560px] text-base leading-[26px] text-pl-muted sm:text-lg sm:leading-7">
              Digital purchase — your files are ready the moment payment clears.
            </p>
          </header>

          <CheckoutForm
            cart={cart}
            defaultEmail={user.email}
            defaultName={user.name ?? ""}
            providerLabel={provider.label}
            isTestMode={provider.isTestMode}
          />
        </div>
      </div>
    </div>
  );
}
