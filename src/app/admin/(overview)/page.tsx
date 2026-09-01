import type { Metadata } from "next";
import Link from "next/link";
import { DollarSign, ShoppingCart, Users, Package, ArrowRight, TriangleAlert } from "lucide-react";

import { AdminPageHeader, AdminSection } from "@/components/admin/admin-page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import {
  RevenueChart,
  OrdersChart,
  CustomerGrowthChart,
  SalesByCategoryChart,
} from "@/components/admin/charts";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import {
  getDashboardStats,
  getRevenueSeries,
  getBestSellers,
  getRecentOrders,
  getCustomerGrowth,
  getSalesByCategory,
} from "@/lib/queries/analytics";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The dashboard's panels reuse `AdminSection` rather than a local card, so a
 * chart panel here and a table card on a resource page are the same surface.
 *
 * `Reveal` wraps them for the one soft fade the admin allows — no travel, no
 * stagger. This is a workspace: motion exists only to soften charts arriving
 * after their data resolves, never to make an operator wait to read a number.
 */
function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Reveal variant="in" as="div" className={className}>
      <AdminSection title={title} action={action} bodyClassName={bodyClassName}>
        {children}
      </AdminSection>
    </Reveal>
  );
}

export default async function AdminDashboardPage() {
  const [
    stats,
    revenue,
    bestSellers,
    recentOrders,
    growth,
    salesByCategory,
  ] = await Promise.all([
    getDashboardStats(),
    getRevenueSeries(),
    getBestSellers(5),
    getRecentOrders(6),
    getCustomerGrowth(),
    getSalesByCategory(),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Overview"
        description="Store performance at a glance. Comparisons are against the previous 30 days."
        className="mb-0"
      />

      {stats.unsellable > 0 && (
        <Link
          href="/admin/products?fileState=unsellable"
          className="group flex items-center gap-3 rounded-md border border-warning/25 bg-warning/[0.06] px-4 py-3 text-sm transition-colors duration-150 hover:bg-warning/10"
        >
          <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 text-foreground">
            <span className="font-semibold tabular-nums">{stats.unsellable}</span>{" "}
            {stats.unsellable === 1 ? "product has" : "products have"} no file attached and cannot be delivered.
          </span>
          <ArrowRight
            className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      )}

      {/* The only stagger in the admin, and only because these four are the
          first thing on the page. `onMount` — they are above the fold, so an
          observer would fire immediately anyway. */}
      <RevealGroup onMount className="grid [&>*]:min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RevealItem>
          <StatCard
            label="Total revenue"
            value={formatMoney(stats.revenueTotalCents)}
            delta={stats.revenueDelta}
            icon={DollarSign}
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Orders"
            value={String(stats.ordersTotal)}
            delta={stats.ordersDelta}
            icon={ShoppingCart}
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Customers"
            value={String(stats.customersTotal)}
            delta={null}
            hint={`${stats.customers30} joined in the last 30 days`}
            icon={Users}
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Active products"
            value={String(stats.productsActive)}
            delta={null}
            hint={`Average order ${formatMoney(stats.averageOrderCents)}`}
            icon={Package}
          />
        </RevealItem>
      </RevealGroup>

      {/* Revenue spans the full width now that the orders-by-status donut has
          gone. That chart counted every order regardless of payment, so on a
          store that has been through payment testing its largest slice was
          PENDING — abandoned checkouts presented on the business overview as
          though customers were queued up waiting to pay. It is a diagnostic
          breakdown, not a business KPI, so it stays on /admin/analytics and on
          /admin/orders and is no longer the first thing the dashboard says. */}
      <Panel title="Revenue — last 12 months">
        <RevenueChart data={revenue} />
      </Panel>

      <div className="grid [&>*]:min-w-0 gap-6 xl:grid-cols-2">
        <Panel title="Orders per month">
          <OrdersChart data={revenue} />
        </Panel>

        <Panel title="New customers">
          <CustomerGrowthChart data={growth} />
        </Panel>
      </div>

      <div className="grid [&>*]:min-w-0 gap-6">
        <Panel title="Revenue by category">
          <SalesByCategoryChart data={salesByCategory} />
        </Panel>
      </div>

      <div className="grid [&>*]:min-w-0 gap-6 xl:grid-cols-2">
        <Panel
          title="Recent orders"
          action={
            <Link
              href="/admin/orders"
              className="group inline-flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              View all
              <ArrowRight
                className="size-3 transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          }
        >
          {recentOrders.length === 0 ? (
            // "No orders yet" would be a lie on a store with unpaid attempts
            // sitting in the table — this panel only ever counts paid ones.
            <p className="py-8 text-center text-sm text-balance text-muted-foreground">
              No completed sales yet.{" "}
              <Link href="/admin/orders" className="text-brand-600 hover:underline">
                See all orders
              </Link>{" "}
              for checkouts that were started but never paid.
            </p>
          ) : (
          <ul className="-mx-2">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/admin/orders/${order.orderNumber}`}
                  // The status pill and amount are unshrinkable, so on a phone
                  // they are allowed onto a second line rather than pushing the
                  // row past the viewport. Unchanged from sm up.
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-[var(--admin-hover)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600 sm:flex-nowrap"
                >
                  <div className="min-w-0 flex-1">
                    <p className="admin-mono text-foreground">{order.orderNumber}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {order.user?.name ?? order.email} · {order._count.items}{" "}
                      {order._count.items === 1 ? "item" : "items"}
                    </p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                  <span className="text-sm font-medium text-foreground tabular-nums">
                    {formatMoney(order.totalCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          )}
        </Panel>

        <Panel title="Best sellers">
          {bestSellers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No sales recorded yet.
            </p>
          ) : (
            <ol className="-mx-2">
              {bestSellers.map((product, index) => (
                <li key={product.productId ?? product.slug}>
                  <Link
                    href={`/products/${product.slug}`}
                    className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-[var(--admin-hover)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600"
                  >
                    {/* Rank as a plain tabular numeral rather than a filled
                        chip — five chips down the left edge read as a column of
                        buttons, which none of them are. */}
                    <span
                      aria-hidden
                      className="w-4 shrink-0 text-xs font-medium text-muted-foreground/70 tabular-nums"
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {product.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {product.unitsSold} sold
                    </span>
                    <span className="shrink-0 text-sm font-medium text-foreground tabular-nums">
                      {formatMoney(product.revenueCents)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
