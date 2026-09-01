import type { Metadata } from "next";
import type { ComponentType, CSSProperties } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Users,
  Package,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

import { AdminSection } from "@/components/admin/admin-page-header";
import {
  RevenueChart,
  OrdersChart,
  CustomerGrowthChart,
  SalesByCategoryChart,
} from "@/components/admin/charts";
import {
  getDashboardStats,
  getRevenueSeries,
  getBestSellers,
  getRecentOrders,
  getCustomerGrowth,
  getSalesByCategory,
} from "@/lib/queries/analytics";
import { getOperationalAlerts } from "@/lib/queries/operational-alerts";
import { ActionCenter } from "@/components/admin/action-center";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

/** Stagger index, as an inline custom property `.admin-rise` reads. */
const step = (index: number) => ({ "--admin-i": index }) as CSSProperties;

/**
 * A secondary metric.
 *
 * Deliberately not a card. Three of these share one surface, divided by
 * hairlines rather than boxed individually — the hero is the only enclosed
 * panel on the page, which is what lets it read as the headline instead of as
 * the first of four equal tiles.
 */
function Metric({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  index,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  icon: ComponentType<{ className?: string }>;
  index: number;
}) {
  const hasDelta = delta !== null && delta !== undefined;
  const positive = (delta ?? 0) >= 0;

  return (
    <div className="admin-rise group px-5 py-5 sm:px-6" style={step(index)}>
      <div className="flex items-center gap-2">
        <Icon
          className="size-3.5 shrink-0 text-muted-foreground/50 transition-colors duration-200 group-hover:text-brand-500"
          aria-hidden
        />
        <p className="admin-eyebrow">{label}</p>
      </div>

      <p className="admin-figure mt-2.5">{value}</p>

      {hasDelta ? (
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium tabular-nums",
              positive ? "text-success" : "text-destructive",
            )}
          >
            {positive ? (
              <ArrowUpRight className="size-3 shrink-0" aria-hidden />
            ) : (
              <ArrowDownRight className="size-3 shrink-0" aria-hidden />
            )}
            {positive ? "+" : ""}
            {delta}%
          </span>
          <span className="text-muted-foreground">vs previous 30 days</span>
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * The overview.
 *
 * One dominant surface — revenue, on deep violet, at display size — and
 * everything else subordinate to it. The composition is deliberately
 * asymmetric: the hero spans two thirds and carries the chart, the order feed
 * takes the remaining third, and the secondary metrics run as a hairline-ruled
 * band beneath rather than as a row of matching cards.
 *
 * Every figure is the same value from the same query as before. Nothing about
 * what is counted has changed — only which of them the eye reaches first.
 */
export default async function AdminDashboardPage() {
  const [stats, revenue, bestSellers, recentOrders, growth, salesByCategory, alerts] =
    await Promise.all([
      getDashboardStats(),
      getRevenueSeries(),
      getBestSellers(5),
      getRecentOrders(6),
      getCustomerGrowth(),
      getSalesByCategory(),
      getOperationalAlerts(),
    ]);

  const revenueUp = (stats.revenueDelta ?? 0) >= 0;

  return (
    <div className="space-y-5">
      {/* ---- Masthead ------------------------------------------------------ */}
      <div
        className="admin-rise flex flex-wrap items-end justify-between gap-x-6 gap-y-3"
        style={step(0)}
      >
        <div>
          <p className="admin-eyebrow">Meemi Art · Command</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-[1.75rem]">
            Overview
          </h1>
        </div>

        {/* The pulse is the only thing moving on the page at rest, which is
            what makes it read as "this is current" rather than as decoration. */}
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex size-1.5 text-success">
            <span className="admin-pulse absolute inset-0 rounded-full" />
            <span className="relative size-1.5 rounded-full bg-success" />
          </span>
          Live · last 30 days vs previous 30
        </p>
      </div>

      {/* ---- Needs attention ---------------------------------------------
          Replaces the standalone "products without a file" banner, which was
          one of six real signals shown alone. Same link, same count, now
          alongside stuck payments, undelivered orders and failed sends. */}
      <ActionCenter alerts={alerts} style={step(1)} />

      {/* ---- Hero + feed, 2:1 ---------------------------------------------- */}
      <div className="grid gap-5 [&>*]:min-w-0 xl:grid-cols-3">
        <section
          className="admin-hero admin-rise xl:col-span-2"
          style={step(2)}
          aria-labelledby="hero-revenue"
        >
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p
                  id="hero-revenue"
                  className="text-[0.625rem] font-semibold tracking-[0.22em] text-brand-300 uppercase"
                >
                  Total revenue
                </p>

                <p className="admin-display admin-reveal-figure mt-3 text-white">
                  {formatMoney(stats.revenueTotalCents)}
                </p>

                <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {stats.revenueDelta !== null && stats.revenueDelta !== undefined && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums",
                        revenueUp
                          ? "border-[#7ee2b0]/30 bg-[#7ee2b0]/12 text-[#7ee2b0]"
                          : "border-[#ffb4ae]/30 bg-[#ffb4ae]/12 text-[#ffb4ae]",
                      )}
                    >
                      {revenueUp ? (
                        <ArrowUpRight className="size-3" aria-hidden />
                      ) : (
                        <ArrowDownRight className="size-3" aria-hidden />
                      )}
                      {revenueUp ? "+" : ""}
                      {stats.revenueDelta}%
                    </span>
                  )}
                  <span className="text-sm text-brand-300">
                    {formatMoney(stats.revenue30Cents)} in the last 30 days
                  </span>
                </div>
              </div>

              <Link
                href="/admin/analytics"
                className="group inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-brand-200 transition-colors duration-150 hover:border-white/30 hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
              >
                Analytics
                <ArrowRight
                  className="size-3 transition-transform duration-150 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div>
          </div>

          {/* The chart bleeds to the panel edges — no inner card, no rules. */}
          <div className="-mt-2 px-2 pb-4">
            <RevenueChart data={revenue} onDark height="h-64" />
          </div>
        </section>

        {/* ---- Order feed ---------------------------------------------------- */}
        <section
          className="admin-card admin-rise flex flex-col"
          style={step(3)}
          aria-labelledby="feed-heading"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <h2 id="feed-heading" className="text-sm font-semibold text-foreground">
              Recent orders
            </h2>
            <Link
              href="/admin/orders"
              className="group inline-flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              All
              <ArrowRight
                className="size-3 transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            // "No orders yet" would be a lie on a store with unpaid attempts
            // sitting in the table — this feed only ever counts paid ones.
            <p className="flex-1 px-5 py-10 text-center text-sm text-balance text-muted-foreground">
              No completed sales yet.{" "}
              <Link href="/admin/orders" className="text-brand-600 hover:underline">
                See all orders
              </Link>{" "}
              for checkouts that were started but never paid.
            </p>
          ) : (
            /* A feed, not a table: each entry is a marker on a thread, the
               order number leading and its metadata beneath. The connector is
               drawn on the list so it never breaks between rows. */
            <ol className="relative flex-1 px-5 py-2">
              <span
                aria-hidden
                className="absolute top-6 bottom-6 left-[1.5625rem] w-px bg-border"
              />

              {recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.orderNumber}`}
                    className="group relative -mx-2 flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-[var(--admin-hover)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600"
                  >
                    <span
                      aria-hidden
                      className="relative z-10 mt-0.5 flex size-[1.375rem] shrink-0 items-center justify-center rounded-full border border-border bg-card transition-colors duration-150 group-hover:border-brand-300"
                    >
                      <span className="size-1.5 rounded-full bg-success" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="admin-mono text-foreground">
                          {order.orderNumber}
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                          {formatMoney(order.totalCents)}
                        </span>
                      </span>
                      <span className="admin-cell-meta">
                        {order.user?.name ?? order.email} · {order._count.items}{" "}
                        {order._count.items === 1 ? "item" : "items"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* ---- Secondary metrics: one ruled band, not three cards ------------- */}
      <div className="admin-card grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Metric
          index={4}
          label="Orders"
          value={String(stats.ordersTotal)}
          delta={stats.ordersDelta}
          icon={ShoppingCart}
        />
        <Metric
          index={5}
          label="Customers"
          value={String(stats.customersTotal)}
          hint={`${stats.customers30} joined in the last 30 days`}
          icon={Users}
        />
        <Metric
          index={6}
          label="Active products"
          value={String(stats.productsActive)}
          hint={`Average order ${formatMoney(stats.averageOrderCents)}`}
          icon={Package}
        />
      </div>

      {/* ---- Supporting analysis -------------------------------------------- */}
      <div className="grid gap-5 [&>*]:min-w-0 xl:grid-cols-2">
        <AdminSection title="Orders per month" className="admin-rise" style={step(7)}>
          <OrdersChart data={revenue} />
        </AdminSection>

        <AdminSection title="New customers" className="admin-rise" style={step(8)}>
          <CustomerGrowthChart data={growth} />
        </AdminSection>
      </div>

      <div className="grid gap-5 [&>*]:min-w-0 xl:grid-cols-[1.35fr_1fr]">
        <AdminSection title="Revenue by category" className="admin-rise" style={step(9)}>
          <SalesByCategoryChart data={salesByCategory} />
        </AdminSection>

        <AdminSection
          title="Best sellers"
          className="admin-rise"
          bodyClassName="p-3"
          style={step(10)}
        >
          {bestSellers.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No sales recorded yet.
            </p>
          ) : (
            <ol>
              {bestSellers.map((product, index) => (
                <li key={product.productId ?? product.slug}>
                  <Link
                    href={`/products/${product.slug}`}
                    className="group flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-[var(--admin-hover)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600"
                  >
                    {/* Rank set in the display face — the one numeral on the
                        page that is decorative rather than a value to read. */}
                    <span
                      aria-hidden
                      className="font-display w-5 shrink-0 text-base leading-none font-semibold text-brand-300 transition-colors duration-150 group-hover:text-brand-500"
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="admin-cell-primary">{product.name}</span>
                      <span className="admin-cell-meta">{product.unitsSold} sold</span>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-foreground tabular-nums">
                      {formatMoney(product.revenueCents)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </AdminSection>
      </div>
    </div>
  );
}
