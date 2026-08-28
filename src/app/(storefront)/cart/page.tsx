import type { Metadata } from "next";
import { ShoppingBag, ArrowLeft, Lock } from "lucide-react";

import { CartLineItem } from "@/components/cart/cart-line-item";
import { CouponForm } from "@/components/cart/coupon-form";
import { OrderSummary } from "@/components/cart/order-summary";
import { EmptyState } from "@/components/brand/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { getCartWithCoupon } from "@/lib/cart/cart-service";

export const metadata: Metadata = {
  title: "Your bag",
  robots: { index: false, follow: true },
};

export default async function CartPage() {
  const cart = await getCartWithCoupon();

  if (cart.lines.length === 0) {
    return (
      <div className="container-page py-10 lg:py-14">
        <h1 className="heading-section">Your bag</h1>
        <EmptyState
          icon={ShoppingBag}
          title="Your bag is empty"
          description="You haven't added anything yet. Have a look at what's new, or pick up where you left off."
          action={
            <ButtonLink href="/shop" variant="brand" size="pill">
              Start shopping
            </ButtonLink>
          }
          secondaryAction={
            <ButtonLink href="/account/wishlist" variant="brandOutline" size="pill">
              View wishlist
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const hasUnavailable = cart.lines.some((line) => !line.isAvailable);

  return (
    <div className="container-page py-10 lg:py-14">
      <header className="mb-8">
        <h1 className="heading-section">Your bag</h1>
        <p className="text-body mt-2">
          {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"}
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-12">
        <div>
          <ul className="divide-y divide-border border-y border-border">
            {cart.lines.map((line) => (
              <CartLineItem key={line.id} line={line} />
            ))}
          </ul>

          <div className="mt-6">
            <ButtonLink
              href="/shop"
              variant="ghost"
              size="pillSm"
              className="rounded-full px-0 text-muted-foreground hover:text-brand-600"
            >
              <ArrowLeft aria-hidden />
              Continue shopping
            </ButtonLink>
          </div>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <CouponForm appliedCode={cart.coupon?.code ?? null} />
            </div>

            <OrderSummary totals={cart.totals} coupon={cart.coupon}>
              {hasUnavailable && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive"
                >
                  Remove the out-of-stock item above before checking out.
                </p>
              )}

              <ButtonLink
                href="/checkout"
                variant="brand"
                size="pill"
                className={`w-full ${hasUnavailable ? "pointer-events-none opacity-50" : ""}`}
                aria-disabled={hasUnavailable}
                tabIndex={hasUnavailable ? -1 : undefined}
              >
                <Lock aria-hidden />
                Checkout
              </ButtonLink>

              <p className="text-center text-xs text-muted-foreground">
                Tax is calculated by Paddle at checkout.
              </p>
            </OrderSummary>
          </div>
        </aside>
      </div>
    </div>
  );
}
