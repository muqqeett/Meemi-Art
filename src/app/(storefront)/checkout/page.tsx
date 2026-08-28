import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";

import { CheckoutForm } from "@/components/checkout/checkout-form";
import { Logo } from "@/components/brand/logo";
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
 */
export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const cart = await getCartWithCoupon();

  // Nothing to check out — send them back rather than rendering a dead form.
  if (cart.lines.length === 0) redirect("/cart");

  const provider = getPaymentProvider();

  return (
    <div className="container-page py-8 lg:py-12">
      <header className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="heading-section">Checkout</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
            Secure checkout
          </p>
        </div>

        <Logo />
      </header>

      <CheckoutForm
        cart={cart}
        defaultEmail={user.email}
        defaultName={user.name ?? ""}
        providerLabel={provider.label}
        isTestMode={provider.isTestMode}
      />
    </div>
  );
}
