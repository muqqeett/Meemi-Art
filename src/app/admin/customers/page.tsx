import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Users } from "lucide-react";

import { AdminPageHeader, AdminTableCard } from "@/components/admin/admin-page-header";
import { AdminFilters } from "@/components/admin/admin-filters";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { EmptyState } from "@/components/brand/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { listAdminCustomers } from "@/lib/queries/admin";
import { buildBaseQuery, hasAnyParam } from "@/lib/shop-params";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Customers" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminCustomersPage({
  searchParams,
}: PageProps<"/admin/customers">) {
  const raw = await searchParams;

  const { customers, total, page, pageCount } = await listAdminCustomers({
    q: first(raw.q),
    page: Number(first(raw.page)) || 1,
  });

  return (
    <div>
      <AdminPageHeader
        title="Customers"
        description={`${total} registered ${total === 1 ? "customer" : "customers"}`}
      />

      <AdminFilters params={raw} searchPlaceholder="Search by name or email…" />

      {customers.length === 0 ? (
        <AdminTableCard>
          {hasAnyParam(raw, ["q"]) ? (
            <EmptyState
              icon={Users}
              title="No customers match"
              description="Try a different search term, or clear the filter to see everyone."
              action={
                <ButtonLink href="/admin/customers" variant="brand" size="pill">
                  Clear search
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No customers yet"
              description="Shoppers who create an account will appear here, with their order history and lifetime spend."
            />
          )}
        </AdminTableCard>
      ) : (
        <>
          <AdminTableCard>
            <table className="admin-table admin-table-stack min-w-[720px]">
              <caption className="sr-only">Registered customers</caption>
              <thead>
                <tr>
                  <th scope="col">
                    Customer
                  </th>
                  <th scope="col">
                    Joined
                  </th>
                  <th scope="col" className="text-right">
                    Orders
                  </th>
                  <th scope="col" className="text-right">
                    Reviews
                  </th>
                  <th scope="col" className="text-right">
                    Lifetime value
                  </th>
                </tr>
              </thead>

              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td data-label="Customer">
                      <div className="flex items-center gap-3">
                        {customer.image ? (
                          <Image
                            src={customer.image}
                            alt=""
                            width={36}
                            height={36}
                            className="size-9 rounded-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="inline-flex size-9 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700"
                          >
                            {(customer.name ?? customer.email).charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0">
                          <Link
                            href={`/admin/customers/${customer.id}`}
                            className="block truncate font-medium text-foreground hover:text-brand-600"
                          >
                            {customer.name ?? "Unnamed"}
                          </Link>
                          <span className="admin-cell-meta">
                            {customer.email}
                          </span>
                        </span>
                      </div>
                    </td>

                    <td data-label="Joined" className="text-muted-foreground">
                      <time dateTime={customer.createdAt.toISOString()}>
                        {customer.createdAt.toLocaleDateString("en-US", {
                          dateStyle: "medium",
                        })}
                      </time>
                    </td>

                    <td data-label="Orders" className="text-right tabular-nums">
                      {customer.orderCount}
                    </td>
                    <td data-label="Reviews" className="text-right tabular-nums">
                      {customer.reviewCount}
                    </td>
                    <td data-label="Lifetime value" className="text-right font-medium tabular-nums">
                      {formatMoney(customer.totalSpentCents)}
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
            basePath="/admin/customers"
          />
        </>
      )}
    </div>
  );
}
