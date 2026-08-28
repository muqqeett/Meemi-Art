"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { getOrCreateCartId } from "@/lib/cart/cart-service";
import { getAppliedCoupon, clearAppliedCoupon } from "@/lib/cart/coupon";
import { calculateTotals } from "@/lib/cart/totals";
import { getPaymentProvider, paymentConfig, paymentUrl } from "@/lib/payments";
import { productionSafetyProblem } from "@/lib/payments/config";
import { checkoutSchema, type CheckoutInput } from "@/lib/validations/commerce";

export type CheckoutResult =
  | {
      ok: true;
      /** Driver name. The form uses it to choose Paddle.js over a redirect. */
      provider: string;
      /**
       * Paddle's transaction id (`txn_...`). Paddle.js opens the overlay from
       * this alone — the browser is handed a reference to a charge the server
       * already priced, never a basket it could edit.
       */
      providerTransactionId: string;
      /** Hosted page. Fallback for when Paddle.js cannot load. */
      checkoutUrl: string;
      orderNumber: string;
      orderId: string;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function orderNumber(): string {
  const year = new Date().getFullYear();
  return `MA-${year}-${randomInt(100_000, 999_999)}`;
}

/**
 * Create a pending order and hand the customer to the payment provider.
 *
 * What this function does *not* do is as important as what it does: it never
 * marks anything paid and never grants access to a file. It records an
 * intention to buy and returns a hosted checkout URL. The order only becomes
 * real when a signed webhook arrives — see lib/payments/payment-service.ts.
 *
 * Every figure that decides what the customer pays is recomputed here from the
 * database: unit prices come from the product rows, the coupon is re-validated
 * against the live subtotal, and the total handed to the provider is the one
 * this server calculated. The submitted payload is trusted for a name, an
 * email address and an optional note, and for nothing else.
 *
 * Sign-in is required. A download has to be authorised against an account, so
 * a guest purchase would produce a file nobody could ever collect.
 */
export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const user = await requireUser();

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  }

  const data = parsed.data;
  const provider = getPaymentProvider();

  if (!provider.isConfigured) {
    // Refuse rather than take an order that can never be charged — or, worse,
    // one the built-in sandbox driver would "complete" for free on a
    // production deployment. The customer gets an ordinary unavailable
    // message; the operator gets the specific cause in the log and in
    // Admin -> Settings -> Payments.
    const reason = productionSafetyProblem();
    console.error(
      "[checkout] refused: provider not configured.",
      reason ?? `driver="${provider.name}"`,
    );
    return {
      ok: false,
      error: "Payments are not available right now. Please try again shortly.",
    };
  }

  const cartId = await getOrCreateCartId();

  const items = await prisma.cartItem.findMany({
    where: { cartId },
    include: {
      product: {
        include: {
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
          asset: { select: { id: true } },
        },
      },
    },
  });

  if (items.length === 0) {
    return { ok: false, error: "Your bag is empty." };
  }

  type OrderLine = {
    productId: string;
    name: string;
    slug: string;
    sku: string;
    imageUrl: string | null;
    unitPriceCents: number;
    quantity: number;
    totalCents: number;
  };

  const lines: OrderLine[] = [];
  /** Catalogue price ids, kept beside the lines rather than on the order rows. */
  const priceIds = new Map<string, string | null>();

  for (const item of items) {
    const { product } = item;

    // A missing asset would sell a download that does not exist.
    if (!product.isActive || !product.asset) {
      return {
        ok: false,
        error: `${product.name} is no longer available. Remove it from your bag to continue.`,
      };
    }

    // Paddle charges a catalogue price id, so a product that has never been
    // synced has no price Paddle would honour. Refusing here is the difference
    // between an operator seeing a clear error and a customer meeting a broken
    // payment page. The sandbox driver has no catalogue and skips this.
    if (provider.name === "paddle" && !product.paddlePriceId) {
      console.error("[checkout] product not synced to Paddle:", product.id, product.sku);
      return {
        ok: false,
        error: `${product.name} isn't ready to buy yet. Please try again shortly.`,
      };
    }

    // Drift between our price and the synced Paddle price would charge the
    // customer an amount this order does not record. The read-back check in
    // the driver would catch it, but catching it here names the cause.
    if (provider.name === "paddle" && product.paddlePriceCents !== product.priceCents) {
      console.error(
        "[checkout] Paddle price drift on",
        product.id,
        `— ours ${product.priceCents}, Paddle ${product.paddlePriceCents}`,
      );
      return {
        ok: false,
        error: `${product.name} isn't ready to buy yet. Please try again shortly.`,
      };
    }

    const unitPriceCents = product.priceCents;
    priceIds.set(product.id, product.paddlePriceId);

    lines.push({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      imageUrl: product.images[0]?.url ?? null,
      unitPriceCents,
      quantity: item.quantity,
      totalCents: unitPriceCents * item.quantity,
    });
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);

  // Read from the server-side httpOnly cookie, not the payload: the client
  // cannot grant itself a discount, and a stale or ineligible code is simply
  // dropped so the order still completes at full price.
  const coupon = await getAppliedCoupon(subtotalCents);

  const totals = calculateTotals({
    lines: lines.map((line) => ({
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
    })),
    coupon,
  });

  if (totals.totalCents <= 0) {
    return {
      ok: false,
      error: "That order totals nothing to pay. Please contact us instead.",
    };
  }

  const number = orderNumber();

  try {
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: number,
          userId: user.id,
          email: data.email,
          customerName: data.customerName,
          status: "PENDING",

          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          totalCents: totals.totalCents,
          currency: paymentConfig.currency,

          couponId: coupon?.id ?? null,
          couponCode: coupon?.code ?? null,
          notes: data.notes || null,

          items: { create: lines },

          payment: {
            create: {
              provider: provider.name,
              status: "PENDING",
              amountCents: totals.totalCents,
              currency: paymentConfig.currency,
            },
          },
        },
        select: { id: true, orderNumber: true },
      });

      // Coupon usage is counted at completion, not here — an abandoned
      // checkout must not burn a limited-use code.
      return created;
    });

    const session = await provider.createCheckout({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountCents: totals.totalCents,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      currency: paymentConfig.currency,
      customerEmail: data.email,
      customerName: data.customerName,
      lines: lines.map((line) => ({
        productId: line.productId,
        name: line.name,
        unitAmountCents: line.unitPriceCents,
        quantity: line.quantity,
        providerPriceId: priceIds.get(line.productId) ?? null,
      })),
      successUrl: paymentUrl(`/orders/${order.orderNumber}?from=payment`),
      cancelUrl: paymentUrl(`/checkout?cancelled=${order.orderNumber}`),
    });

    await prisma.payment.update({
      where: { orderId: order.id },
      data: {
        providerTransactionId: session.providerTransactionId,
        checkoutUrl: session.checkoutUrl,
        status: "PROCESSING",
      },
    });

    // The bag is deliberately left alone. If the customer abandons the
    // provider's page, they come back to an intact cart rather than an empty
    // one and a mysterious unpaid order.
    revalidatePath("/account/orders");
    revalidatePath("/admin/orders");

    return {
      ok: true,
      provider: provider.name,
      providerTransactionId: session.providerTransactionId,
      checkoutUrl: session.checkoutUrl,
      orderNumber: order.orderNumber,
      orderId: order.id,
    };
  } catch (error) {
    console.error("[checkout] placeOrder failed", error);
    return {
      ok: false,
      error: "We couldn't start your payment. Nothing has been charged — please try again.",
    };
  }
}

/**
 * Empty the bag once an order has actually been paid for.
 *
 * Called from the order page after the webhook has completed the order, not
 * from the success redirect itself.
 */
export async function clearPaidCart(orderId: string): Promise<void> {
  const user = await requireUser();

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id, status: "COMPLETED" },
    select: { id: true },
  });
  if (!order) return;

  const cartId = await getOrCreateCartId();
  await prisma.cartItem.deleteMany({ where: { cartId } });
  await clearAppliedCoupon();
  revalidatePath("/cart");
}
