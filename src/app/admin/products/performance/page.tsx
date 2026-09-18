import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Crown,
  Download,
  FileWarning,
  Package,
  TrendingUp,
} from "lucide-react";

import { AdminPageHeader, AdminSection } from "@/components/admin/admin-page-header";
import { AnalyticsRangePicker } from "@/components/admin/analytics-range-picker";
import { ProductRevenueChart } from "@/components/admin/charts";
import { EmptyState } from "@/components/brand/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { rangeInputFrom, rangeSearch, resolveRange } from "@/lib/analytics/date-range";
import { CONVERSION_DEFINITIONS, formatRate } from "@/lib/analytics/metrics";
import { getProductPerformance, performanceState } from "@/lib/queries/product-performance";
import {
  PRODUCT_SORTS,
  getProductMetricsTable,
  parseProductSort,
  type ProductSort,
} from "@/lib/queries/product-analytics";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Product Performance" };

const step = (index: number) => ({ "--admin-i": index }) as CSSProperties;

const STATE_LABEL = {
  top: "Top performer",
  selling: "Selling",
  "no-sales": "No sales",
  "missing-file": "Missing file",
  draft: "Draft",
} as const;

const STATE_STYLE = {
  top: "border-brand-300 bg-brand-50 text-brand-700",
  selling: "border-success/20 bg-success/8 text-success",
  "no-sales": "border-border bg-[var(--admin-raised)] text-muted-foreground",
  "missing-file": "border-destructive/20 bg-destructive/8 text-destructive",
  draft: "border-border bg-[var(--admin-raised)] text-muted-foreground",
} as const;

/**
 * Which products actually sell.
 *
 * Ranked by revenue, because that is what "performance" means on a shop. The
 * leader gets real visual weight — a crown, its image, the biggest figure —
 * and everything below it is a compact row, so the ranking is scannable rather
 * than eight identical cards.
 *
 * Every number comes from `product-performance.ts`, which reuses the canonical
 * `SUCCESSFUL_ORDER_ITEM` filter. Verified to agree with the dashboard's own
 * revenue and order totals.
 *
 * The product funnel below the ranking adds views, add-to-cart and checkout
 * starts from `product-analytics.ts`, with every rate's denominator stated. Views
 * are counted only from the day the event log was deployed, so for older
 * periods a conversion rate is "—" rather than a made-up figure.
 *
 * Periods are calendar days in Pakistan. The old `?period=` links still work.
 */
export default async function ProductPerformancePage({
  searchParams,
}: PageProps<"/admin/products/performance">) {
  const raw = await searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const input = rangeInputFrom(raw);
  // Bookmarks from before the shared picker used `?period=7d` and friends.
  if (!input.preset) input.preset = one(raw.period) ?? null;
  const { range, invalid } = resolveRange(input, new Date(), { allowAll: true });
  const periodLabel = range.label;
  const sort = parseProductSort(one(raw.sort));
  const requestedPage = Number.parseInt(one(raw.page) ?? "1", 10);

  const [data, table] = await Promise.all([
    getProductPerformance(range),
    getProductMetricsTable(range, sort, Number.isFinite(requestedPage) ? requestedPage : 1),
  ]);
  const { products, totals, top } = data;
  const period = rangeSearch(range);
  const tableHref = (next: { sort?: ProductSort; page?: number }) => {
    const params = new URLSearchParams(period);
    params.set("sort", next.sort ?? sort);
    if ((next.page ?? 1) > 1) params.set("page", String(next.page));
    return `/admin/products/performance?${params.toString()}#product-funnel`;
  };

  const sellers = products.filter((p) => p.revenueCents > 0);
  const hasProducts = products.length > 0;
  const hasSales = sellers.length > 0;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Insights"
        title="Product performance"
        description="Which products drive sales, revenue and downloads."
        className="mb-0"
        action={
          // Real server-side filtering: each choice re-runs the queries with
          // different `placedAt` bounds. Nothing is filtered in the browser.
          <AnalyticsRangePicker
            basePath="/admin/products/performance"
            range={range}
            invalid={invalid}
            allowAll
            keep={sort === "revenue" ? {} : { sort }}
          />
        }
      />

      {!hasProducts ? (
        <AdminSection className="admin-rise" style={step(0)} bodyClassName="p-0">
          <EmptyState
            variant="inline"
            icon={Package}
            title="No products yet"
            description="Create a product before performance can be measured."
            action={
              <ButtonLink href="/admin/products/new" variant="brand" size="pill">
                Add a product
              </ButtonLink>
            }
          />
        </AdminSection>
      ) : (
        <>
          {/* ---- Hero: the leader, or the honest absence of one ------------ */}
          <section
            className="admin-hero admin-rise overflow-hidden"
            style={step(0)}
            aria-labelledby="performance-hero"
          >
            <div className="p-6 sm:p-8">
              <p
                id="performance-hero"
                className="text-[0.625rem] font-semibold tracking-[0.22em] text-brand-300 uppercase"
              >
                {periodLabel} · revenue
              </p>

              <p className="admin-display admin-reveal-figure mt-3 text-white">
                {formatMoney(totals.revenueCents)}
              </p>

              {hasSales ? (
                <>
                  <p className="mt-3.5 text-sm text-brand-300">
                    <span className="tabular-nums">{totals.unitsSold}</span>{" "}
                    {totals.unitsSold === 1 ? "unit" : "units"} across{" "}
                    <span className="tabular-nums">{totals.orders}</span>{" "}
                    {totals.orders === 1 ? "order" : "orders"} ·{" "}
                    <span className="tabular-nums">{totals.sellingCount}</span> of{" "}
                    <span className="tabular-nums">{totals.productCount}</span> products
                    sold
                  </p>

                  {top && (
                    <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-md border border-white/12 bg-white/[0.06] px-4 py-3">
                      <Crown className="size-4 shrink-0 text-[#ffd479]" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.625rem] font-semibold tracking-[0.18em] text-brand-300 uppercase">
                          Top performer
                        </span>
                        <span className="mt-0.5 block truncate text-sm font-medium text-white">
                          {top.name}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-lg font-semibold text-white tabular-nums">
                          {formatMoney(top.revenueCents)}
                        </span>
                        <span className="block text-xs text-brand-300 tabular-nums">
                          {top.unitsSold} sold
                        </span>
                      </span>
                    </div>
                  )}
                </>
              ) : (
                // Products exist but nothing sold in this window. Not an error,
                // and not dressed up as one.
                <p className="mt-3.5 max-w-md text-sm leading-relaxed text-brand-300">
                  No sales in this period. Readiness for every product is listed
                  below — try a longer period if the shop is new.
                </p>
              )}
            </div>
          </section>

          {/* ---- Supporting counts ---------------------------------------- */}
          <div
            className="admin-card admin-rise grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0"
            style={step(1)}
          >
            {[
              {
                label: "Units sold",
                value: String(totals.unitsSold),
                hint: periodLabel,
              },
              {
                label: "Orders",
                value: String(totals.orders),
                hint: "Containing products",
              },
              {
                label: "Avg / selling product",
                value: formatMoney(totals.averageRevenuePerSellingProduct),
                hint: `${totals.sellingCount} sold`,
              },
              {
                label: "Downloads",
                value: String(totals.downloadsAllTime),
                // Stated, not hidden: the schema keeps a running total with no
                // per-period breakdown, so this figure ignores the filter.
                hint: "All time",
              },
            ].map((m) => (
              <div key={m.label} className="px-5 py-4">
                <p className="admin-eyebrow">{m.label}</p>
                <p className="mt-1.5 text-xl font-semibold text-foreground tabular-nums">
                  {m.value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{m.hint}</p>
              </div>
            ))}
          </div>

          {/* ---- Revenue chart -------------------------------------------- */}
          <AdminSection
            title="Revenue by product"
            description={`Paid and completed orders · ${periodLabel}`}
            className="admin-rise"
            style={step(2)}
          >
            <ProductRevenueChart
              data={sellers.map((p) => ({
                name: p.name,
                revenueCents: p.revenueCents,
                unitsSold: p.unitsSold,
              }))}
            />
          </AdminSection>

          {/* ---- Ranking --------------------------------------------------- */}
          <AdminSection
            title="Top products"
            description="Ranked by revenue. Ties fall back to units sold."
            className="admin-rise"
            style={step(3)}
            bodyClassName="p-0"
          >
            <div className="w-full overflow-x-auto">
              <table className="admin-table admin-table-stack sm:min-w-[860px]">
                <caption className="sr-only">Products ranked by revenue</caption>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col" className="text-right">Revenue</th>
                    <th scope="col" className="text-right">Units</th>
                    <th scope="col" className="text-right">Orders</th>
                    <th scope="col" className="text-right">Downloads</th>
                    <th scope="col">State</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, index) => {
                    const state = performanceState(product, top?.revenueCents ?? 0);
                    const leader = state === "top";

                    return (
                      <tr key={product.id}>
                        <td data-label="Product">
                          <span className="flex items-center gap-3">
                            <span
                              aria-hidden
                              className="w-4 shrink-0 text-xs font-medium text-muted-foreground/70 tabular-nums"
                            >
                              {index + 1}
                            </span>

                            {product.imageUrl ? (
                              <span className="relative size-9 shrink-0 overflow-hidden rounded-md border border-border bg-[var(--admin-raised)]">
                                <Image
                                  src={product.imageUrl}
                                  alt=""
                                  fill
                                  sizes="36px"
                                  className="object-cover"
                                />
                              </span>
                            ) : (
                              <span
                                aria-hidden
                                className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-[var(--admin-raised)] text-muted-foreground"
                              >
                                <Package className="size-4" />
                              </span>
                            )}

                            <span className="min-w-0">
                              <Link
                                href={`/admin/products/${product.id}/edit`}
                                className={cn(
                                  "block truncate hover:text-royal-600",
                                  // The leader carries more weight than row 8.
                                  leader
                                    ? "font-semibold text-foreground"
                                    : "font-medium text-foreground",
                                )}
                              >
                                {product.name}
                              </Link>
                              <span className="block truncate text-xs text-muted-foreground">
                                {formatMoney(product.priceCents)}
                                {product.version && ` · file v${product.version}`}
                              </span>
                            </span>
                          </span>
                        </td>

                        <td
                          data-label="Revenue"
                          className={cn(
                            "text-right tabular-nums",
                            leader ? "font-semibold text-foreground" : "text-foreground",
                          )}
                        >
                          {formatMoney(product.revenueCents)}
                        </td>

                        <td data-label="Units" className="text-right tabular-nums text-muted-foreground">
                          {product.unitsSold}
                        </td>

                        <td data-label="Orders" className="text-right tabular-nums text-muted-foreground">
                          {product.orders}
                        </td>

                        <td data-label="Downloads" className="text-right tabular-nums text-muted-foreground">
                          {product.downloads}
                        </td>

                        <td data-label="State">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                              STATE_STYLE[state],
                            )}
                          >
                            {state === "top" && <Crown className="size-3" aria-hidden />}
                            {state === "missing-file" && (
                              <FileWarning className="size-3" aria-hidden />
                            )}
                            {state === "selling" && (
                              <TrendingUp className="size-3" aria-hidden />
                            )}
                            {STATE_LABEL[state]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AdminSection>

          {/* ---- Funnel per product ---------------------------------------- */}
          <AdminSection
            title="Product funnel"
            description={`Views to purchases per product · ${periodLabel}. Conversion = ${CONVERSION_DEFINITIONS.conversion}. Reviews and rating are all time.`}
            className="admin-rise scroll-mt-6"
            style={step(4)}
            bodyClassName="p-0"
          >
            <div id="product-funnel" className="w-full overflow-x-auto">
              <table className="admin-table admin-table-stack sm:min-w-[1080px]">
                <caption className="sr-only">
                  Product funnel, sorted by {PRODUCT_SORTS[sort].toLowerCase()}, highest first
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    {(Object.keys(PRODUCT_SORTS) as ProductSort[]).map((key) => (
                      <th
                        key={key}
                        scope="col"
                        className="text-right"
                        aria-sort={sort === key ? "descending" : undefined}
                      >
                        <Link
                          href={tableHref({ sort: key })}
                          className={cn(
                            "inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground",
                            sort === key && "text-foreground",
                          )}
                        >
                          {PRODUCT_SORTS[key]}
                          {sort === key && <ArrowDown className="size-3" aria-hidden />}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Product">
                        <span className="min-w-0">
                          <Link
                            href={`/admin/products/performance/${row.id}?${period}`}
                            className="block truncate font-medium text-foreground hover:text-royal-600"
                          >
                            {row.name}
                          </Link>
                          <span className="block truncate text-xs text-muted-foreground">
                            {row.categoryName}
                            {!row.isActive && " · Draft"}
                          </span>
                        </span>
                      </td>
                      <td data-label="Revenue" className="text-right text-foreground tabular-nums">
                        {formatMoney(row.revenueCents)}
                      </td>
                      <td data-label="Purchases" className="text-right tabular-nums text-muted-foreground">
                        {row.purchases}
                      </td>
                      <td data-label="Views" className="text-right tabular-nums text-muted-foreground">
                        {row.views}
                      </td>
                      <td data-label="Conversion" className="text-right tabular-nums text-muted-foreground">
                        {formatRate(row.conversion)}
                      </td>
                      <td data-label="Add to cart" className="text-right tabular-nums text-muted-foreground">
                        {row.addToCart}
                      </td>
                      <td data-label="Checkout starts" className="text-right tabular-nums text-muted-foreground">
                        {row.checkoutStarts}
                      </td>
                      <td data-label="Wishlist adds" className="text-right tabular-nums text-muted-foreground">
                        {row.wishlistAdds}
                      </td>
                      <td data-label="Downloads" className="text-right tabular-nums text-muted-foreground">
                        {row.downloads}
                      </td>
                      <td data-label="Reviews" className="text-right tabular-nums text-muted-foreground">
                        {row.reviews}
                      </td>
                      <td data-label="Rating" className="text-right tabular-nums text-muted-foreground">
                        {row.rating === null ? "—" : row.rating.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {table.pages > 1 && (
              <nav
                aria-label="Product funnel pages"
                className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm"
              >
                <span className="text-muted-foreground tabular-nums">
                  Page {table.page} of {table.pages} · {table.total} products
                </span>
                <span className="flex gap-1.5">
                  {table.page > 1 ? (
                    <ButtonLink href={tableHref({ page: table.page - 1 })} variant="outline" size="sm">
                      <ChevronLeft aria-hidden />
                      Previous
                    </ButtonLink>
                  ) : null}
                  {table.page < table.pages ? (
                    <ButtonLink href={tableHref({ page: table.page + 1 })} variant="outline" size="sm">
                      Next
                      <ChevronRight aria-hidden />
                    </ButtonLink>
                  ) : null}
                </span>
              </nav>
            )}
          </AdminSection>

          {/* ---- Downloads ------------------------------------------------- */}
          <AdminSection
            title="Download performance"
            description="All time — the schema keeps a running total per grant, with no per-period history."
            className="admin-rise"
            style={step(5)}
            bodyClassName="p-0"
          >
            {totals.downloadsAllTime === 0 ? (
              <EmptyState
                variant="inline"
                icon={Download}
                title="No downloads recorded"
                description="A customer may have purchased without downloading yet. This is not a delivery failure."
              />
            ) : (
              <ul className="divide-y divide-border">
                {[...products]
                  .filter((p) => p.grants > 0 || p.downloads > 0)
                  .sort((a, b) => b.downloads - a.downloads)
                  .map((product) => (
                    <li
                      key={product.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {product.name}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {product.grants} {product.grants === 1 ? "grant" : "grants"}
                      </span>
                      <span className="text-sm font-medium text-foreground tabular-nums">
                        {product.downloads}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {product.downloads === 1 ? "download" : "downloads"}
                        </span>
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </AdminSection>

          {/* Delivery incidents belong to Delivery Health — linked, not
              duplicated here. */}
          {totals.publishedMissingFile > 0 && (
            <Link
              href="/admin/delivery"
              className="admin-rise group flex items-center gap-3 rounded-md border border-destructive/25 bg-destructive/[0.06] px-4 py-3 text-sm transition-colors duration-150 hover:bg-destructive/10"
              style={step(6)}
            >
              <FileWarning className="size-4 shrink-0 text-destructive" aria-hidden />
              <span className="min-w-0 text-foreground">
                <span className="font-semibold tabular-nums">
                  {totals.publishedMissingFile}
                </span>{" "}
                published{" "}
                {totals.publishedMissingFile === 1 ? "product has" : "products have"} no
                digital file and cannot be delivered.
              </span>
              <ArrowRight
                className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          )}
        </>
      )}
    </div>
  );
}
