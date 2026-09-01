import type { Metadata } from "next";
import Link from "next/link";
import { DollarSign, ShoppingCart, Users, Package, ArrowRight, TriangleAlert } from "lucide-react";

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
 * Panels fade in as they reach the viewport — no travel, no stagger.
 *
 * The admin is a workspace, not a campaign page: motion here exists only to
 * soften the arrival of charts that render after their data resolves. Anything
 * that made an operator wait to read a number would be a bug.
 */
function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Reveal
      variant="in"
      as="section"
      className={`rounded-2xl border border-border bg-card p-5 shadow-card ${className ?? ""}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
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
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-body mt-1">
          Store performance at a glance. Comparisons are against the previous 30 days.
        </p>
      </header>

      {stats.unsellable > 0 && (
        <Link
          href="/admin/products?fileState=unsellable"
          className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm transition-colors hover:bg-warning/10"
        >
          <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden />
          <span className="text-foreground">
            <span className="font-semibold">{stats.unsellable}</span>{" "}
            {stats.unsellable === 1 ? "product has" : "products have"} no file attached and cannot be delivered.
          </span>
          <ArrowRight className="ml-auto size-4 text-muted-foreground" aria-hidden />
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
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"
            >
              View all
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        >
          {recentOrders.length === 0 ? (
            // "No orders yet" would be a lie on a store with unpaid attempts
            // sitting in the table — this panel only ever counts paid ones.
            <p className="py-6 text-center text-sm text-muted-foreground">
              No completed sales yet.{" "}
              <Link href="/admin/orders" className="text-brand-600 hover:underline">
                See all orders
              </Link>{" "}
              for checkouts that were started but never paid.
            </p>
          ) : (
          <ul className="divide-y divide-border">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/admin/orders/${order.orderNumber}`}
                  // The status pill and amount are unshrinkable, so on a phone
                  // they are allowed onto a second line rather than pushing the
                  // row past the viewport. Unchanged from sm up.
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 transition-colors hover:text-brand-600 sm:flex-nowrap"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-medium">{order.orderNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {order.user?.name ?? order.email} · {order._count.items}{" "}
                      {order._count.items === 1 ? "item" : "items"}
                    </p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                  <span className="text-sm font-medium tabular-nums">
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
            <p className="py-6 text-center text-sm text-muted-foreground">
              No sales recorded yet.
            </p>
          ) : (
            <ol className="divide-y divide-border">
              {bestSellers.map((product, index) => (
                <li key={product.productId ?? product.slug}>
                  <Link
                    href={`/products/${product.slug}`}
                    className="flex items-center gap-3 py-3 transition-colors hover:text-brand-600"
                  >
                    <span
                      aria-hidden
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-alt text-xs font-semibold text-muted-foreground"
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {product.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {product.unitsSold} sold
                    </span>
                    <span className="text-sm font-medium tabular-nums">
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
