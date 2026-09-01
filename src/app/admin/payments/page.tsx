import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";

import { AdminPageHeader, AdminTableCard } from "@/components/admin/admin-page-header";
import { StatusBadge } from "@/components/admin/admin-primitives";
import { EmptyState } from "@/components/brand/empty-state";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { listAdminPayments } from "@/lib/queries/admin-resources";
import { buildBaseQuery } from "@/lib/shop-params";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Payments" };

/** Tone by meaning, not by string — see `StatusBadge`. */
function tone(status: string) {
  if (status === "PAID") return "positive" as const;
  if (status === "REFUNDED" || status === "FAILED" || status === "CANCELLED") {
    return "critical" as const;
  }
  return "pending" as const;
}

/**
 * Every charge the provider has reported, straight from `Payment`.
 *
 * Read-only: payments are written by the signed webhook and by the reconcile
 * action, and neither belongs behind a table row. Nothing here is derived —
 * amount, status and card details are the columns as stored.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: PageProps<"/admin/payments">) {
  const raw = await searchParams;
  const { payments, total, page, pageCount } = await listAdminPayments({
    page: Number(raw.page) || 1,
  });

  return (
    <div>
      <AdminPageHeader
        title="Payments"
        description={`${total.toLocaleString("en-US")} ${total === 1 ? "charge" : "charges"} recorded by the payment provider.`}
      />

      {payments.length === 0 ? (
        <AdminTableCard>
          <EmptyState
            variant="inline"
            icon={CreditCard}
            title="No payments yet"
            description="Charges appear here once a customer completes checkout and the provider's signed webhook confirms the payment."
          />
        </AdminTableCard>
      ) : (
        <>
          <AdminTableCard>
            <table className="w-full min-w-[860px] text-sm">
              <caption className="sr-only">Payments</caption>
              <thead className="bg-surface-alt text-left">
                <tr className="text-xs tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Order
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Customer
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Amount
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Method
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Date
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-surface-alt/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${payment.order.orderNumber}`}
                        className="font-mono text-xs font-medium text-foreground hover:text-royal-600"
                      >
                        {payment.order.orderNumber}
                      </Link>
                    </td>

                    <td className="max-w-56 px-4 py-3">
                      <span className="block truncate text-foreground">
                        {payment.order.customerName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {payment.order.email}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-medium tabular-nums">
                      {formatMoney(payment.amountCents)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        {payment.currency}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="capitalize">{payment.provider.toLowerCase()}</span>
                      {payment.cardLast4 && (
                        <span className="block text-xs">
                          {payment.cardBrand} ···· {payment.cardLast4}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge tone={tone(payment.status)}>
                        {payment.status.toLowerCase()}
                      </StatusBadge>
                      {payment.failureReason && (
                        <span className="mt-1 block max-w-48 truncate text-xs text-destructive">
                          {payment.failureReason}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      <time
                        dateTime={(payment.paidAt ?? payment.createdAt).toISOString()}
                      >
                        {(payment.paidAt ?? payment.createdAt).toLocaleDateString("en-US", {
                          dateStyle: "medium",
                        })}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableCard>

          <PaginationNav
            page={page}
            pageCount={pageCount}
            baseQuery={buildBaseQuery(raw)}
            basePath="/admin/payments"
          />
        </>
      )}
    </div>
  );
}
