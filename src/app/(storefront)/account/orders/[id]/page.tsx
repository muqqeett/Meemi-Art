import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { OrderDetailView } from "@/components/orders/order-detail-view";
import { requireUser } from "@/lib/auth-guards";
import { getOrderForViewer } from "@/lib/queries/orders";

export const metadata: Metadata = {
  title: "Order details",
  robots: { index: false, follow: false },
};

export default async function AccountOrderDetailPage({
  params,
}: PageProps<"/account/orders/[id]">) {
  const { id } = await params;
  await requireUser(`/account/orders/${id}`);

  // `getOrderForViewer` re-checks ownership; a signed-in user cannot read
  // another customer's order by guessing an order number.
  const order = await getOrderForViewer(id);
  if (!order) notFound();

  return (
    <div>
      <Link
        href="/account/orders"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-brand-600"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to orders
      </Link>

      <OrderDetailView order={order} />
    </div>
  );
}
