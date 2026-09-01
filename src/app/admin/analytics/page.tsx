import type { Metadata } from "next";
import Link from "next/link";
import { DollarSign, ShoppingCart, Users, TrendingUp } from "lucide-react";

import { AdminPageHeader, AdminTableCard } from "@/components/admin/admin-page-header";
import { StatCard } from "@/components/admin/stat-card";
import {
  RevenueChart,
  OrdersChart,
  CustomerGrowthChart,
} from "@/components/admin/charts";
import {
  getDashboardStats,
  getRevenueSeries,
  getBestSellers,
  getCustomerGrowth,
} from "@/lib/queries/analytics";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Analytics" };

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-border bg-card p-5 shadow-card ${className ?? ""}`}
    >
      <h2 className="mb-4 text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default async function AdminAnalyticsPage() {
  const [stats, revenue, bestSellers, growth] = await Promise.all([
    getDashboardStats(),
    getRevenueSeries(),
    getBestSellers(10),
    getCustomerGrowth(),
  ]);

  const totalUnits = bestSellers.reduce((sum, product) => sum + product.unitsSold, 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Analytics"
        description="Revenue, orders and customer trends. Comparisons are against the previous 30 days."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue (30 days)"
          value={formatMoney(stats.revenue30Cents)}
          delta={stats.revenueDelta}
          icon={DollarSign}
        />
        <StatCard
          label="Orders (30 days)"
          value={String(stats.orders30)}
          delta={stats.ordersDelta}
          icon={ShoppingCart}
        />
        <StatCard
          label="Average order value"
          value={formatMoney(stats.averageOrderCents)}
          delta={null}
          hint="Across all time"
          icon={TrendingUp}
        />
        <StatCard
          label="New customers (30 days)"
          value={String(stats.customers30)}
          delta={null}
          hint={`${stats.customersTotal} total`}
          icon={Users}
        />
      </div>

      <Panel title="Revenue — last 12 months">
        <RevenueChart data={revenue} />
      </Panel>

      {/* "Order status mix" used to sit beside this. It counted every order
          regardless of payment, so on a store that has been through payment
          testing it read as a backlog of customers waiting to pay. Order state
          is an operational question and belongs on /admin/orders, which shows
          it per row and can filter by it. */}
      <Panel title="Orders per month">
        <OrdersChart data={revenue} />
      </Panel>

      <Panel title="Customer growth">
        <CustomerGrowthChart data={growth} />
      </Panel>

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Top products by units sold
        </h2>

        <AdminTableCard>
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Best selling products</caption>
            <thead className="bg-surface-alt text-left">
              <tr className="text-xs tracking-wide text-muted-foreground uppercase">
                <th scope="col" className="px-4 py-3 font-medium">
                  #
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Product
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Units
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Revenue
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Share
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {bestSellers.map((product, index) => {
                const share = totalUnits > 0 ? (product.unitsSold / totalUnits) * 100 : 0;

                return (
                  <tr key={product.slug} className="hover:bg-surface-alt/60">
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/products/${product.slug}`}
                        className="font-medium text-foreground hover:text-brand-600"
                      >
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {product.unitsSold}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatMoney(product.revenueCents)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-1.5 w-24 overflow-hidden rounded-full bg-border"
                          role="img"
                          aria-label={`${share.toFixed(0)}% of top-seller units`}
                        >
                          <div
                            className="h-full rounded-full bg-brand-600"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {share.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminTableCard>
      </section>
    </div>
  );
}
