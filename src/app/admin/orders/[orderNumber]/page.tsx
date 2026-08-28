import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Mail, Calendar } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { OrderDetailView } from "@/components/orders/order-detail-view";
import { OrderStatusForm } from "@/components/admin/order-status-form";
import { getAdminOrder } from "@/lib/queries/admin";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Order details" };

export default async function AdminOrderPage({
  params,
}: PageProps<"/admin/orders/[orderNumber]">) {
  const { orderNumber } = await params;
  const order = await getAdminOrder(orderNumber);

  if (!order) notFound();

  return (
    <div>
      <Link
        href="/admin/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-brand-600"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to orders
      </Link>

      <AdminPageHeader
        title={order.orderNumber}
        description={`Placed ${order.placedAt.toLocaleDateString("en-US", { dateStyle: "long" })} · ${formatMoney(order.totalCents)}`}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <OrderDetailView order={order} />
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Manage order</h2>
            <OrderStatusForm
              orderId={order.id}
              currentStatus={order.status}
            />
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Customer</h2>

            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <User className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                <div>
                  <dt className="sr-only">Name</dt>
                  <dd>
                    {order.user ? (
                      <Link
                        href={`/admin/customers/${order.user.id}`}
                        className="font-medium text-foreground hover:text-brand-600"
                      >
                        {order.user.name ?? order.customerName}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">
                        {order.customerName}
                      </span>
                    )}
                    {!order.user && (
                      <span className="block text-xs text-muted-foreground">
                        Guest checkout
                      </span>
                    )}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                <div className="min-w-0">
                  <dt className="sr-only">Email</dt>
                  <dd className="truncate">
                    <a
                      href={`mailto:${order.email}`}
                      className="text-muted-foreground hover:text-brand-600"
                    >
                      {order.email}
                    </a>
                  </dd>
                </div>
              </div>

              {order.user && (
                <div className="flex items-start gap-2.5">
                  <Calendar className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                  <div>
                    <dt className="sr-only">Customer since</dt>
                    <dd className="text-muted-foreground">
                      Customer since{" "}
                      {order.user.createdAt.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                      })}
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
