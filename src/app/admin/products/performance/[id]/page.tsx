import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  DollarSign,
  Download,
  Eye,
  Heart,
  Package,
  ShoppingBag,
  ShoppingCart,
  Star,
  CreditCard,
} from "lucide-react";

import { AdminPageHeader, AdminSection } from "@/components/admin/admin-page-header";
import { AnalyticsFunnel } from "@/components/admin/analytics-funnel";
import { AnalyticsRangePicker } from "@/components/admin/analytics-range-picker";
import { DailyTrendChart } from "@/components/admin/charts";
import { StatCard } from "@/components/admin/stat-card";
import { rangeInputFrom, rangeSearch, resolveRange } from "@/lib/analytics/date-range";
import { formatRate } from "@/lib/analytics/metrics";
import { getProductAnalytics } from "@/lib/queries/product-analytics";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Product Analytics" };

const step = (index: number) => ({ "--admin-i": index }) as CSSProperties;

/**
 * One product's funnel over a period, against the period before it.
 *
 * Purchases and revenue come from order lines on `SUCCESSFUL_ORDER`s, dated by
 * the order's `placedAt`; checkout starts are that product's lines on orders of
 * any status. Views, add-to-cart, wishlist adds and dated downloads come from
 * the event log, so they start on the day it was deployed. Reviews, the
 * current wishlist and access grants are current state, labelled as such.
 *
 * Periods are calendar days in Pakistan. "All time" is not offered: a daily
 * series over the shop's whole life is not a useful chart.
 */
export default async function ProductAnalyticsPage({
  params,
  searchParams,
}: PageProps<"/admin/products/performance/[id]">) {
  const [{ id }, raw] = await Promise.all([params, searchParams]);
  const { range, invalid } = resolveRange(rangeInputFrom(raw), new Date());

  const data = await getProductAnalytics(id, range);
  if (!data) notFound();

  const { product, current, changes, reviews, wishlist, access, series } = data;
  const basePath = `/admin/products/performance/${product.id}`;
  const deltaLabel = "vs previous period";
  const reviewsMax = Math.max(1, ...reviews.distribution.map((row) => row.count));

  return (
    <div className="space-y-5">
      <Link
        href={`/admin/products/performance?${rangeSearch(range)}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Product performance
      </Link>

      <AdminPageHeader
        eyebrow="Product analytics"
        title={product.name}
        description={`${product.categoryName} · ${formatMoney(product.priceCents)}${product.isActive ? "" : " · Draft"}`}
        className="mb-0"
        action={<AnalyticsRangePicker basePath={basePath} range={range} invalid={invalid} />}
      />

      {/* ---- Overview ---------------------------------------------------- */}
      <section
        className="admin-card admin-rise flex flex-wrap items-center gap-4 p-5"
        style={step(0)}
        aria-label="Product overview"
      >
        {product.imageUrl ? (
          <span className="relative size-14 shrink-0 overflow-hidden rounded-md border border-border bg-[var(--admin-raised)]">
            <Image src={product.imageUrl} alt="" fill sizes="56px" className="object-cover" />
          </span>
        ) : (
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-md border border-border bg-[var(--admin-raised)] text-muted-foreground"
          >
            <Package className="size-5" />
          </span>
        )}
        <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="admin-eyebrow">Status</dt>
            <dd className="mt-0.5 text-foreground">{product.isActive ? "Published" : "Draft"}</dd>
          </div>
          <div>
            <dt className="admin-eyebrow">Price</dt>
            <dd className="mt-0.5 text-foreground tabular-nums">
              {formatMoney(product.priceCents)}
              {product.compareAtCents ? (
                <span className="ml-1.5 text-xs text-muted-foreground line-through">
                  {formatMoney(product.compareAtCents)}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="admin-eyebrow">File</dt>
            <dd className="mt-0.5 text-foreground">
              {product.hasFile ? `Uploaded${product.fileVersion ? ` · v${product.fileVersion}` : ""}` : "Missing"}
            </dd>
          </div>
          <div>
            <dt className="admin-eyebrow">Links</dt>
            <dd className="mt-0.5 flex gap-3">
              <Link href={`/admin/products/${product.id}/edit`} className="text-royal-600 hover:underline">
                Edit
              </Link>
              {product.isActive && (
                <Link href={`/products/${product.slug}`} className="text-royal-600 hover:underline">
                  View in shop
                </Link>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* ---- Headline figures -------------------------------------------- */}
      <div className="admin-kpi-row grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatMoney(current.revenueCents)}
          delta={changes.revenue}
          deltaLabel={deltaLabel}
          hint={`${current.orders} ${current.orders === 1 ? "order" : "orders"} · line totals`}
          icon={DollarSign}
        />
        <StatCard
          label="Purchases"
          value={String(current.purchases)}
          delta={changes.purchases}
          deltaLabel={deltaLabel}
          hint="Units on paid, completed orders"
          icon={ShoppingBag}
        />
        <StatCard
          label="Views"
          value={String(current.views)}
          delta={changes.views}
          deltaLabel={deltaLabel}
          hint={`${current.visitorDays} visitor-days`}
          icon={Eye}
        />
        <StatCard
          label="Conversion"
          value={formatRate(current.rates.conversion)}
          delta={null}
          hint="Purchases ÷ views"
          icon={ShoppingCart}
        />
        <StatCard
          label="Add to cart"
          value={String(current.addToCart)}
          delta={changes.addToCart}
          deltaLabel={deltaLabel}
          icon={ShoppingCart}
        />
        <StatCard
          label="Checkout starts"
          value={String(current.checkoutStarts)}
          delta={changes.checkoutStarts}
          deltaLabel={deltaLabel}
          hint="Orders placed, any status"
          icon={CreditCard}
        />
        <StatCard
          label="Wishlist adds"
          value={String(current.wishlistAdds)}
          delta={changes.wishlistAdds}
          deltaLabel={deltaLabel}
          hint={`${wishlist.savedNow} saved now`}
          icon={Heart}
        />
        <StatCard
          label="Downloads"
          value={String(current.downloads)}
          delta={changes.downloads}
          deltaLabel={deltaLabel}
          hint={`${access.downloadsAllTime} all time`}
          icon={Download}
        />
      </div>

      {/* ---- Funnel + trend ---------------------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <AdminSection title="Funnel" description={range.label} className="admin-rise" style={step(1)}>
          <AnalyticsFunnel counts={current} />
        </AdminSection>

        <AdminSection title="Daily activity" description="Views, add to cart and purchases per day" className="admin-rise" style={step(2)}>
          <DailyTrendChart
            data={series}
            label={`Daily views, add to cart and purchases for ${product.name}`}
            series={[
              { key: "views", label: "Views", tone: "royal" },
              { key: "addToCart", label: "Add to cart", tone: "violet" },
              { key: "purchases", label: "Purchases", tone: "brand" },
            ]}
          />
        </AdminSection>
      </div>

      <AdminSection title="Daily revenue" description="Line totals on paid, completed orders, by order date" className="admin-rise" style={step(3)}>
        <DailyTrendChart
          data={series}
          money
          label={`Daily revenue for ${product.name}`}
          series={[{ key: "revenue", label: "Revenue", tone: "brand" }]}
        />
      </AdminSection>

      {/* ---- Current state ----------------------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-3">
        <AdminSection title="Reviews" description="Approved reviews, all time" className="admin-rise" style={step(4)}>
          {reviews.count === 0 ? (
            <p className="text-sm text-muted-foreground">No approved reviews yet.</p>
          ) : (
            <>
              <p className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-foreground tabular-nums">
                  {reviews.average?.toFixed(1)}
                </span>
                <Star className="size-4 fill-current text-[#e0a526]" aria-hidden />
                <span className="text-sm text-muted-foreground">
                  from {reviews.count} {reviews.count === 1 ? "review" : "reviews"}
                </span>
              </p>
              <ul className="mt-4 space-y-1.5">
                {reviews.distribution.map((row) => (
                  <li key={row.stars} className="flex items-center gap-3 text-sm">
                    <span className="w-12 shrink-0 text-muted-foreground">{row.stars} star</span>
                    <span aria-hidden className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--admin-raised)]">
                      <span
                        className="block h-full rounded-full bg-brand-600"
                        style={{ width: `${(row.count / reviewsMax) * 100}%` }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right text-foreground tabular-nums">{row.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </AdminSection>

        <AdminSection title="Wishlist" description="Current state" className="admin-rise" style={step(5)}>
          <dl className="space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Saved right now</dt>
              <dd className="text-lg font-semibold text-foreground tabular-nums">{wishlist.savedNow}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Saved and already bought</dt>
              <dd className="text-lg font-semibold text-foreground tabular-nums">{wishlist.savedAndBought}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Added in this period</dt>
              <dd className="text-lg font-semibold text-foreground tabular-nums">{current.wishlistAdds}</dd>
            </div>
          </dl>
        </AdminSection>

        <AdminSection title="Access and downloads" description="All time, from access grants" className="admin-rise" style={step(6)}>
          <dl className="space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Grants</dt>
              <dd className="text-lg font-semibold text-foreground tabular-nums">
                {access.grants}
                {access.activeGrants !== access.grants && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">({access.activeGrants} active)</span>
                )}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Downloads</dt>
              <dd className="text-lg font-semibold text-foreground tabular-nums">{access.downloadsAllTime}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Downloads per grant</dt>
              <dd className="text-lg font-semibold text-foreground tabular-nums">
                {access.downloadRate === null ? "—" : access.downloadRate.toFixed(1)}
              </dd>
            </div>
          </dl>
        </AdminSection>
      </div>
    </div>
  );
}
