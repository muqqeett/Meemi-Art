import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { paymentConfig } from "@/lib/payments";
import { formatMoney } from "@/lib/money";
import { SandboxPaymentPanel } from "@/components/checkout/sandbox-payment-panel";

export const metadata: Metadata = {
  title: "Sandbox payment",
  robots: { index: false, follow: false },
};

/**
 * Stands in for the provider's hosted checkout while the sandbox driver runs.
 *
 * It looks nothing like a real payment page on purpose — it is a control panel
 * for choosing which outcome to test, not a facsimile of one. Anyone who
 * reaches this by accident should be able to tell immediately that no money is
 * involved.
 *
 * 404s unless the sandbox driver is selected, so it cannot appear on a
 * deployment wired to Paddle.
 */
export default async function SandboxCheckoutPage({
  searchParams,
}: PageProps<"/checkout/sandbox">) {
  if (paymentConfig.driver !== "sandbox") notFound();

  const user = await requireUser("/checkout");
  const { order: orderId } = await searchParams;

  if (typeof orderId !== "string") notFound();

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    select: {
      id: true,
      orderNumber: true,
      totalCents: true,
      currency: true,
      status: true,
      items: { select: { id: true, name: true, quantity: true, totalCents: true } },
    },
  });
  if (!order) notFound();

  return (
    <div data-fill className="font-figtree flex-1 bg-pl-page px-4 py-12 text-pl-text sm:px-8 lg:py-16">
      <div className="mx-auto max-w-lg">
        <p className="inline-flex rounded-full bg-pl-tint-templates px-3 py-1 text-[13px] leading-[18px] font-bold text-pl-text">
          Sandbox — no real money
        </p>
        <h1 className="pl-display mt-4 text-[34px] leading-[38px] tracking-[-0.03em]">Test payment</h1>
        <p className="mt-2 text-base leading-[26px] text-pl-muted">
          This page replaces the payment provider while{" "}
          <code className="font-mono text-xs">PAYMENT_PROVIDER=sandbox</code>. Choosing an
          outcome sends a signed webhook to the real endpoint, which verifies it exactly
          as it would a live one.
        </p>

        <div className="mt-8 rounded-[20px] border border-pl-line bg-pl-surface p-5 shadow-pl-sm">
          <p className="font-mono text-sm font-bold">{order.orderNumber}</p>

          <ul className="mt-4 space-y-2 border-y border-pl-line py-4 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span>
                  {item.name}
                  {item.quantity > 1 && (
                    <span className="text-pl-muted"> × {item.quantity}</span>
                  )}
                </span>
                <span className="tabular-nums">{formatMoney(item.totalCents)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between text-base font-bold">
            <span>Total ({order.currency})</span>
            <span className="pl-display pl-price tabular-nums">{formatMoney(order.totalCents)}</span>
          </div>
        </div>

        <SandboxPaymentPanel
          orderId={order.id}
          orderNumber={order.orderNumber}
          totalCents={order.totalCents}
          alreadyComplete={order.status === "COMPLETED"}
        />
      </div>
    </div>
  );
}
