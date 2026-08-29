import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { OrderDetailView } from "@/components/orders/order-detail-view";
import { OrderConfirmed } from "@/components/orders/order-confirmed";
import { ButtonLink } from "@/components/ui/button-link";
import { getOrderForViewer } from "@/lib/queries/orders";
import { isEmailConfigured } from "@/lib/email";
import { getCurrentUser } from "@/lib/auth-guards";
import { getReviewEligibility, type OwnReview } from "@/lib/queries/reviews";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

export default async function OrderPage({
  params,
  searchParams,
}: PageProps<"/orders/[orderNumber]">) {
  const [{ orderNumber }, query] = await Promise.all([params, searchParams]);

  const order = await getOrderForViewer(orderNumber);
  // A 404 rather than a 403: an order the caller cannot see should not be
  // confirmed to exist.
  if (!order) notFound();

  /**
   * Did the customer just come back from paying?
   *
   * `from=payment` is what the checkout actually sets as its success URL —
   * see `successUrl` in lib/actions/checkout.ts. The page previously looked
   * only for `placed=1`, which nothing in the codebase ever sets, so the
   * confirmation panel never rendered: a paying customer landed on a bare
   * "Order details" heading with no acknowledgement and no route to their
   * files. `placed=1` is still honoured so any older link keeps working.
   */
  const returnedFromPayment = query.from === "payment" || query.placed === "1";

  /**
   * Whether the money is actually confirmed.
   *
   * Reaching this URL proves only that the customer's browser was redirected
   * here, which anyone can do by typing it. The order status is written solely
   * by the signed webhook, so that is what decides which message is shown —
   * the page reports state, it never grants anything.
   */
  const isPaid = order.status === "COMPLETED" && order.payment?.status === "PAID";
  const isReversed = order.status === "CANCELLED" || order.status === "REFUNDED";
  /** Paid webhooks are usually instant, but they are not synchronous. */
  const awaitingConfirmation = returnedFromPayment && !isPaid && !isReversed;

  // Never tell a shopper mail went out when the provider isn't configured.
  const emailConfigured = isEmailConfigured();

  /**
   * Which lines this viewer may review.
   *
   * Asked per product, not per order. This page used to require *this* order
   * to be COMPLETED and PAID, which quietly hid the button whenever the same
   * product also sat on an order that was not — the customer had paid, but the
   * page they happened to open said otherwise. `getReviewEligibility` asks
   * whether they ever bought it, on any paid order, with no time limit.
   *
   * Still scoped to the order's own owner: `getOrderForViewer` also admits
   * admins and guests holding a remembered id, and neither should be offered a
   * review form on someone else's receipt. That is a question of whose page
   * this is, not of who may review — an admin who bought the product themselves
   * still gets the form on the product page.
   *
   * The submit action re-checks eligibility independently, so this map only
   * decides what to draw, never what is allowed.
   */
  const viewer = await getCurrentUser();
  let reviewable: Record<string, OwnReview | null> | undefined;

  if (viewer && order.userId === viewer.id) {
    const eligibility = await getReviewEligibility(
      viewer.id,
      order.items
        .map((item) => item.productId)
        .filter((id): id is string => Boolean(id)),
    );

    if (eligibility.size > 0) reviewable = Object.fromEntries(eligibility);
  }

  return (
    <div className="container-page max-w-4xl py-10 lg:py-14">
      {/* Paid and confirmed: the files exist, so the download is the whole
          point of this panel and gets the primary button. */}
      {returnedFromPayment && isPaid && (
        <OrderConfirmed
          heading="Thank you — your order is confirmed"
          actions={
            <>
              <ButtonLink href="/account/downloads" variant="brand" size="pill">
                <Download className="size-4" aria-hidden />
                View my downloads
              </ButtonLink>
              <ButtonLink href="/account/orders" variant="brandOutline" size="pill">
                View all orders
              </ButtonLink>
              <ButtonLink href="/shop" variant="brandOutline" size="pill">
                Keep shopping
              </ButtonLink>
            </>
          }
        >
          <p>
            Your {order.items.length === 1 ? "file is" : "files are"} ready now in{" "}
            <span className="font-medium text-foreground">My Downloads</span>, and they
            stay there — you can download them again whenever you need to.
            {emailConfigured ? (
              <>
                {" "}
                We&apos;ve emailed a receipt to{" "}
                <span className="font-medium text-foreground">{order.email}</span>.
              </>
            ) : (
              <>
                {" "}
                Email delivery isn&apos;t configured on this environment, so no receipt
                was sent — this order is saved against{" "}
                <span className="font-medium text-foreground">{order.email}</span>.
              </>
            )}
          </p>
        </OrderConfirmed>
      )}

      {/* Back from the payment page, but no confirmed payment yet. Deliberately
          does not say "thank you" or offer a downloads button: the webhook is
          the only thing that can make this order real, and claiming success
          before it lands is exactly the failure this whole design avoids. */}
      {awaitingConfirmation && (
        <OrderConfirmed
          heading="Confirming your payment"
          actions={
            <>
              <ButtonLink
                href={`/orders/${order.orderNumber}?from=payment`}
                variant="brand"
                size="pill"
              >
                Refresh
              </ButtonLink>
              <ButtonLink href="/account/orders" variant="brandOutline" size="pill">
                View all orders
              </ButtonLink>
            </>
          }
        >
          <p>
            We&apos;re waiting for your payment provider to confirm this order. It
            usually takes a few seconds. Nothing further is needed from you — once it
            clears, your files appear in{" "}
            <span className="font-medium text-foreground">My Downloads</span> and a
            receipt goes to{" "}
            <span className="font-medium text-foreground">{order.email}</span>.
          </p>
        </OrderConfirmed>
      )}

      {/* Whenever no confirmation panel is showing — including a customer who
          returns from payment to an order that was cancelled or refunded, whose
          explanation `OrderDetailView` renders itself. Without this the page
          would have no level-one heading at all in that case. */}
      {!(returnedFromPayment && (isPaid || awaitingConfirmation)) && (
        <header className="mb-8">
          <h1 className="heading-section">Order details</h1>
        </header>
      )}

      <OrderDetailView order={order} reviewable={reviewable} />
    </div>
  );
}
