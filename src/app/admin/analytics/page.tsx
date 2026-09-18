import type { Metadata } from "next";
import Link from "next/link";
import {
  DollarSign,
  Download,
  Eye,
  Heart,
  Percent,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";

import { AdminPageHeader, AdminTableCard } from "@/components/admin/admin-page-header";
import { AnalyticsFunnel } from "@/components/admin/analytics-funnel";
import { AnalyticsRangePicker } from "@/components/admin/analytics-range-picker";
import { StatCard } from "@/components/admin/stat-card";
import {
  RevenueChart,
  OrdersChart,
  CustomerGrowthChart,
  DailyTrendChart,
} from "@/components/admin/charts";
import {
  getDashboardStats,
  getRevenueSeries,
  getBestSellers,
  getCustomerGrowth,
} from "@/lib/queries/analytics";
import { rangeInputFrom, resolveRange } from "@/lib/analytics/date-range";
import { CONVERSION_DEFINITIONS, formatRate } from "@/lib/analytics/metrics";
import { getAnalyticsOverview } from "@/lib/queries/product-analytics";
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
      className={`admin-card p-5 ${className ?? ""}`}
    >
      <h2 className="mb-4 text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Store-wide analytics.
 *
 * The headline figures, funnel and daily charts follow the chosen period —
 * calendar days in Pakistan, compared with the same number of days just
 * before. Revenue is `SUCCESSFUL_ORDER` totals by `placedAt`; views, add to
 * cart, wishlist adds and downloads come from the event log (see
 * `lib/analytics/metrics.ts` for every definition). The 12-month charts and
 * best sellers below are unchanged and do not follow the period.
 */
export default async function AdminAnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  const { range, invalid } = resolveRange(rangeInputFrom(await searchParams), new Date());

  const [overview, stats, revenue, bestSellers, growth] = await Promise.all([
    getAnalyticsOverview(range),
    getDashboardStats(),
    getRevenueSeries(),
    getBestSellers(10),
    getCustomerGrowth(),
  ]);

  const totalUnits = bestSellers.reduce((sum, product) => sum + product.unitsSold, 0);
  const { current, changes } = overview;
  const deltaLabel = "vs previous period";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Analytics"
        description="Revenue, orders, customers and product activity. Comparisons are against the previous period of the same length."
        action={<AnalyticsRangePicker basePath="/admin/analytics" range={range} invalid={invalid} />}
      />

      <div className="admin-kpi-row grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatMoney(current.revenueCents)}
          delta={changes.revenue}
          deltaLabel={deltaLabel}
          icon={DollarSign}
        />
        <StatCard
          label="Orders"
          value={String(current.orders)}
          delta={changes.orders}
          deltaLabel={deltaLabel}
          hint="Paid and completed"
          icon={ShoppingCart}
        />
        <StatCard
          label="Customers"
          value={String(current.customers)}
          delta={changes.customers}
          deltaLabel={deltaLabel}
          hint={`${current.newCustomers} new sign-ups · ${stats.customersTotal} total`}
          icon={Users}
        />
        <StatCard
          label="Average order value"
          value={current.averageOrderCents === null ? "—" : formatMoney(current.averageOrderCents)}
          delta={changes.averageOrder}
          deltaLabel={deltaLabel}
          icon={TrendingUp}
        />
        <StatCard
          label="Product views"
          value={String(current.views)}
          delta={changes.views}
          deltaLabel={deltaLabel}
          hint={`${current.visitorDays} visitor-days`}
          icon={Eye}
        />
        <StatCard
          label="Purchases"
          value={String(current.purchases)}
          delta={changes.purchases}
          deltaLabel={deltaLabel}
          hint="Units sold"
          icon={ShoppingBag}
        />
        <StatCard
          label="Conversion"
          value={formatRate(current.conversion)}
          delta={null}
          hint={CONVERSION_DEFINITIONS.conversion}
          icon={Percent}
        />
        <StatCard
          label="Wishlist adds"
          value={String(current.wishlistAdds)}
          delta={changes.wishlistAdds}
          deltaLabel={deltaLabel}
          icon={Heart}
        />
        <StatCard
          label="Downloads"
          value={String(current.downloads)}
          delta={changes.downloads}
          deltaLabel={deltaLabel}
          icon={Download}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title={`Store funnel — ${range.label}`}>
          <AnalyticsFunnel counts={current} />
        </Panel>
        <Panel title="Daily revenue">
          <DailyTrendChart
            data={overview.series}
            money
            label={`Daily revenue, ${range.label}`}
            series={[{ key: "revenue", label: "Revenue", tone: "brand" }]}
          />
        </Panel>
      </div>

      <Panel title="Daily activity">
        <DailyTrendChart
          data={overview.series}
          label={`Daily product views, add to cart and purchases, ${range.label}`}
          series={[
            { key: "views", label: "Views", tone: "royal" },
            { key: "addToCart", label: "Add to cart", tone: "violet" },
            { key: "purchases", label: "Purchases", tone: "brand" },
          ]}
        />
      </Panel>

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
          <table className="admin-table admin-table-stack sm:min-w-[560px]">
            <caption className="sr-only">Best selling products</caption>
            <thead>
              <tr>
                <th scope="col">
                  #
                </th>
                <th scope="col">
                  Product
                </th>
                <th scope="col" className="text-right">
                  Units
                </th>
                <th scope="col" className="text-right">
                  Revenue
                </th>
                <th scope="col">
                  Share
                </th>
              </tr>
            </thead>

            <tbody>
              {bestSellers.map((product, index) => {
                const share = totalUnits > 0 ? (product.unitsSold / totalUnits) * 100 : 0;

                return (
                  <tr key={product.slug}>
                    <td data-label="Product" className="text-muted-foreground tabular-nums">
                      {index + 1}
                    </td>
                    <td data-label="Category">
                      <Link
                        href={`/products/${product.slug}`}
                        className="font-medium text-foreground hover:text-brand-600"
                      >
                        {product.name}
                      </Link>
                    </td>
                    <td data-label="Units" className="text-right tabular-nums">
                      {product.unitsSold}
                    </td>
                    <td data-label="Revenue" className="text-right font-medium tabular-nums">
                      {formatMoney(product.revenueCents)}
                    </td>
                    <td data-label="Share">
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
