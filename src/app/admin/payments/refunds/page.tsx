import type { Metadata } from "next";
import Link from "next/link";
import { RotateCcw, Info } from "lucide-react";

import { AdminPageHeader, AdminTableCard } from "@/components/admin/admin-page-header";
import { EmptyState } from "@/components/brand/empty-state";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { listAdminRefunds } from "@/lib/queries/admin-resources";
import { buildBaseQuery } from "@/lib/shop-params";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Refunds" };

/**
 * Refunds — reporting only.
 *
 * The schema records that a refund happened and when: `Payment.status` becomes
 * REFUNDED and `refundedAt` is stamped by the `payment_refunded` webhook. It
 * does not record a refunded amount, a reason, a requester, or a
 * requested-vs-processed distinction, and it cannot represent a partial refund
 * — there is no refunded-amount column.
 *
 * So this page reports the facts that are true and states plainly which columns
 * do not exist, rather than printing empty "Reason" and "Requested" headers
 * that would read as missing data instead of absent capability.
 *
 * Issuing a refund is not offered here. That needs a Paddle API call, and the
 * payment layer is out of scope for this phase.
 */
export default async function AdminRefundsPage({
  searchParams,
}: PageProps<"/admin/payments/refunds">) {
  const raw = await searchParams;
  const { payments, total, page, pageCount } = await listAdminRefunds({
    page: Number(raw.page) || 1,
  });

  const chargedOnThisPage = payments.reduce((sum, payment) => sum + payment.amountCents, 0);

  return (
    <div>
      <AdminPageHeader
        title="Refunds"
        description={`${total.toLocaleString("en-US")} refunded ${total === 1 ? "payment" : "payments"}.`}
      />

      <div className="mb-6 flex items-start gap-3 admin-card px-4 py-3.5">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-body text-sm">
          Refunds are issued in Paddle and recorded here when its signed webhook
          arrives. The amount shown is the <strong>original charge</strong> — the
          database does not store a separate refunded amount, a reason, or partial
          refunds, so those are not displayed rather than guessed.
        </p>
      </div>

      {payments.length === 0 ? (
        <AdminTableCard>
          <EmptyState
            variant="inline"
            icon={RotateCcw}
            title="No refunds"
            description="Nothing has been refunded. Refunds appear here automatically when Paddle reports one."
          />
        </AdminTableCard>
      ) : (
        <>
          <AdminTableCard>
            <table className="admin-table admin-table-stack min-w-[760px]">
              <caption className="sr-only">Refunded payments</caption>
              <thead>
                <tr>
                  <th scope="col">
                    Order
                  </th>
                  <th scope="col">
                    Customer
                  </th>
                  <th scope="col">
                    Original charge
                  </th>
                  <th scope="col">
                    Paid
                  </th>
                  <th scope="col">
                    Refunded
                  </th>
                </tr>
              </thead>

              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td data-label="Order">
                      <Link
                        href={`/admin/orders/${payment.order.orderNumber}`}
                        className="admin-mono font-medium text-foreground transition-colors duration-150 hover:text-brand-600"
                      >
                        {payment.order.orderNumber}
                      </Link>
                    </td>

                    <td data-label="Customer" className="max-w-56">
                      <span className="admin-cell-primary">
                        {payment.order.customerName}
                      </span>
                      <span className="admin-cell-meta">
                        {payment.order.email}
                      </span>
                    </td>

                    <td data-label="Original charge" className="font-medium tabular-nums">
                      {formatMoney(payment.amountCents)}
                    </td>

                    <td data-label="Paid" className="whitespace-nowrap text-muted-foreground">
                      {payment.paidAt ? (
                        <time dateTime={payment.paidAt.toISOString()}>
                          {payment.paidAt.toLocaleDateString("en-US", { dateStyle: "medium" })}
                        </time>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td data-label="Refunded" className="whitespace-nowrap text-muted-foreground">
                      {payment.refundedAt ? (
                        <time dateTime={payment.refundedAt.toISOString()}>
                          {payment.refundedAt.toLocaleDateString("en-US", {
                            dateStyle: "medium",
                          })}
                        </time>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
              Original charge value on this page:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatMoney(chargedOnThisPage)}
              </span>
            </div>
          </AdminTableCard>

          <PaginationNav
            page={page}
            pageCount={pageCount}
            baseQuery={buildBaseQuery(raw)}
            basePath="/admin/payments/refunds"
          />
        </>
      )}
    </div>
  );
}
