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
 * Every other storefront page is a band of content in the 1400px site gutter.
 * That is right for a catalogue and wrong here: at 1440 it let the form run to
 * roughly 950px wide, and with a 356px footer directly beneath it the payment
 * step read as one more section of a long page rather than as the thing the
 * page is for.
 *
 * So this route claims the height `main` now hands down (`min-h-full`) and
 * lays itself out as a column: context bar, workspace, reassurance. The
 * workspace is the flexible row, which is what keeps the footer at the bottom
 * of a short viewport without a single magic number — no `calc(100vh - 64px)`
 * guess that breaks when the announcement banner shows.
 */
export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const cart = await getCartWithCoupon();

  // Nothing to check out — send them back rather than rendering a dead form.
  if (cart.lines.length === 0) redirect("/cart");

  const provider = getPaymentProvider();

  return (
    <div data-fill className="flex min-h-full flex-col bg-surface-alt/35">
      {/* Context bar. The header above says "Meemi Art"; this says "you are
          paying now, and here is the way back". */}
      <div className="border-b border-border/70 bg-card/70">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link
            href="/cart"
            className="inline-flex h-11 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:h-auto"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to bag
          </Link>

          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="size-3.5 text-brand-600" aria-hidden />
            Secure checkout
          </p>
        </div>
      </div>

      {/* The flexible row: it absorbs the leftover viewport height, so the
          footer sits at the bottom on a short screen and scrolls normally on a
          tall order. */}
      <div className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-[1120px] px-5 py-10 sm:px-8 lg:py-14">
          <header className="mb-8 lg:mb-10">
            <h1 className="heading-section">Checkout</h1>
            <p className="text-body mt-1.5 text-sm">
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
