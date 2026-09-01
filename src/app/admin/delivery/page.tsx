import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  Download,
  FileWarning,
  PackageCheck,
  ShieldCheck,
  ShieldX,
  TriangleAlert,
} from "lucide-react";

import { AdminPageHeader, AdminSection } from "@/components/admin/admin-page-header";
import { EmptyState } from "@/components/brand/empty-state";
import {
  getDeliveryHealth,
  getProductDeliveryReadiness,
  getRecentDeliveryActivity,
} from "@/lib/queries/delivery-health";
import { formatBytes } from "@/lib/format-bytes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Delivery Health" };

const step = (index: number) => ({ "--admin-i": index }) as CSSProperties;

/**
 * Can the customers who paid actually get their files?
 *
 * One question, answered at the top, then the evidence for the answer beneath
 * it. The hero states the verdict; the pipeline shows where the chain holds or
 * breaks; the issue list names the affected orders; product readiness says
 * which products would fail a sale made right now.
 *
 * Deliberately not a second Order 360 — nothing here drills into one order's
 * history. It links out to that page instead. This screen is about the store.
 *
 * Every figure comes from `delivery-health.ts`, which is read-only. There are
 * no actions on this page: it is a monitoring surface, and the things an
 * operator would do about a problem already have their own guarded screens.
 */
export default async function AdminDeliveryPage() {
  const [health, products, activity] = await Promise.all([
    getDeliveryHealth(),
    getProductDeliveryReadiness(),
    getRecentDeliveryActivity(8),
  ]);

  const { metrics, issues, pipeline, healthy } = health;
  const notReady = products.filter((p) => p.state === "missing-file");

  // Share of completed orders that actually reached the customer. Only
  // meaningful once something has been sold — with no sales there is no rate,
  // and showing "100%" for an empty store would be a claim about nothing.
  const deliveryRate =
    metrics.completedOrders > 0
      ? Math.round((metrics.deliveredOrders / metrics.completedOrders) * 100)
      : null;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Operations"
        title="Delivery health"
        description="Whether every paid order reached the customer as a downloadable file."
        className="mb-0"
      />

      {/* ---- Verdict + pipeline ------------------------------------------- */}
      <section
        className={cn("admin-hero admin-rise overflow-hidden")}
        style={step(0)}
        aria-labelledby="delivery-verdict"
      >
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
            <div className="min-w-0">
              <p
                id="delivery-verdict"
                className="text-[0.625rem] font-semibold tracking-[0.22em] text-brand-300 uppercase"
              >
                Digital delivery
              </p>

              <p className="admin-display admin-reveal-figure mt-3 flex items-center gap-3 text-white">
                {healthy ? "Healthy" : "Needs attention"}
              </p>

              <p className="mt-3.5 max-w-md text-sm leading-relaxed text-brand-300">
                {healthy ? (
                  <>
                    Every completed order has digital access, every published
                    product has a file, and nothing is revoked.
                  </>
                ) : (
                  <>
                    {issues.length > 0 && (
                      <>
                        {issues.length}{" "}
                        {issues.length === 1 ? "paid order is" : "paid orders are"}{" "}
                        missing access.{" "}
                      </>
                    )}
                    {metrics.productsMissingFile > 0 && (
                      <>
                        {metrics.productsMissingFile}{" "}
                        {metrics.productsMissingFile === 1 ? "product has" : "products have"}{" "}
                        no file to deliver.{" "}
                      </>
                    )}
                    {metrics.revokedOnLive > 0 && (
                      <>
                        {metrics.revokedOnLive} live{" "}
                        {metrics.revokedOnLive === 1 ? "grant is" : "grants are"} revoked.
                      </>
                    )}
                  </>
                )}
              </p>
            </div>

            {deliveryRate !== null && (
              <div className="text-right">
                <p className="text-[0.625rem] font-semibold tracking-[0.22em] text-brand-300 uppercase">
                  Delivered
                </p>
                <p className="admin-display admin-reveal-figure mt-2 text-white tabular-nums">
                  {deliveryRate}%
                </p>
                <p className="mt-1 text-xs text-brand-300 tabular-nums">
                  {metrics.deliveredOrders} of {metrics.completedOrders} completed
                </p>
              </div>
            )}
          </div>

          {/* The chain. Horizontal from `sm`, stacked below it — the connector
              rotates rather than the stages shrinking, so it stays meaningful
              at 320px instead of becoming three cramped columns. */}
          <ol className="mt-7 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
            {pipeline.map((stage, index) => {
              const previous = pipeline[index - 1];
              const dropped = previous ? previous.count - stage.count : 0;

              return (
                <li
                  key={stage.key}
                  className="admin-rise flex items-center gap-2 sm:flex-1 sm:flex-col sm:items-stretch"
                  style={step(index + 1)}
                >
                  <div
                    className={cn(
                      "flex flex-1 items-center gap-3 rounded-md border px-4 py-3 sm:flex-col sm:items-start sm:gap-1",
                      dropped > 0
                        ? "border-[#ffb4ae]/35 bg-[#ffb4ae]/10"
                        : "border-white/12 bg-white/[0.06]",
                    )}
                  >
                    <span className="text-xl font-semibold text-white tabular-nums sm:text-2xl">
                      {stage.count}
                    </span>
                    <span className="text-xs text-brand-300">{stage.label}</span>
                    {dropped > 0 && (
                      <span className="ml-auto text-xs font-medium text-[#ffb4ae] sm:ml-0 sm:mt-1">
                        −{dropped} lost here
                      </span>
                    )}
                  </div>

                  {index < pipeline.length - 1 && (
                    <ChevronRight
                      aria-hidden
                      className="size-4 shrink-0 rotate-90 self-center text-brand-300/50 sm:rotate-0"
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ---- Supporting counts -------------------------------------------- */}
      <div className="admin-card admin-rise grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0" style={step(4)}>
        {[
          { label: "Access grants", value: metrics.grantsTotal, hint: "Files unlocked" },
          { label: "Downloads", value: metrics.downloadsTotal, hint: "Recorded total" },
          { label: "Published products", value: metrics.activeProducts, hint: "Purchasable now" },
          { label: "Missing files", value: metrics.productsMissingFile, hint: "Cannot be delivered" },
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

      {/* ---- Delivery issues ---------------------------------------------- */}
      <AdminSection
        title="Delivery issues"
        description="Paid orders where the customer cannot download what they bought."
        className="admin-rise"
        style={step(5)}
        bodyClassName={issues.length === 0 ? "p-0" : "p-0"}
      >
        {issues.length === 0 ? (
          <div className="flex items-start gap-3.5 px-5 py-6">
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-success/25 bg-success/8 text-success"
            >
              <ShieldCheck className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                Delivery is healthy
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                Every paid order currently has valid digital access. No delivery
                issues detected.
              </span>
            </span>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {issues.map((issue, index) => (
              <li key={issue.orderId}>
                <Link
                  href={`/admin/orders/${issue.orderNumber}`}
                  className="admin-rise group flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-4 transition-colors duration-150 hover:bg-[var(--admin-hover)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600"
                  style={step(index)}
                >
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-destructive/25 bg-destructive/8 text-destructive"
                  >
                    <CircleAlert className="size-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="admin-mono block break-all text-foreground">
                      {issue.orderNumber}
                    </span>
                    {/* Long addresses wrap rather than widening the row. */}
                    <span className="mt-0.5 block break-all text-xs text-muted-foreground">
                      {issue.customerName} · {issue.email}
                    </span>
                    <span className="mt-1.5 block text-xs leading-relaxed text-destructive">
                      {issue.problem}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {issue.granted}/{issue.items} granted
                    </span>
                    <ArrowRight
                      className="size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      {/* ---- Product readiness -------------------------------------------- */}
      <AdminSection
        title="Product readiness"
        description={
          notReady.length > 0
            ? `${notReady.length} published ${notReady.length === 1 ? "product cannot" : "products cannot"} be delivered.`
            : "Every published product has a file attached."
        }
        className="admin-rise"
        style={step(6)}
        bodyClassName="p-0"
      >
        <div className="w-full overflow-x-auto">
          <table className="admin-table admin-table-stack sm:min-w-[720px]">
            <caption className="sr-only">Product delivery readiness</caption>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Digital file</th>
                <th scope="col">Grants</th>
                <th scope="col">Downloads</th>
                <th scope="col">State</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td data-label="Product">
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      className="font-medium text-foreground hover:text-royal-600"
                    >
                      {product.name}
                    </Link>
                  </td>

                  <td data-label="Digital file" className="text-muted-foreground">
                    {product.hasFile ? (
                      <span className="block">
                        {/* The filename and size only. `storageKey` is never
                            queried, let alone rendered — it is what would let
                            someone sign their own download URL. */}
                        <span className="block truncate text-foreground">
                          {product.filename}
                        </span>
                        <span className="text-xs">
                          {formatBytes(product.bytes)}
                          {product.version && ` · v${product.version}`}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </td>

                  <td data-label="Grants" className="tabular-nums text-muted-foreground">
                    {product.grants}
                  </td>

                  <td data-label="Downloads" className="tabular-nums text-muted-foreground">
                    {product.downloads}
                  </td>

                  <td data-label="State">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                        product.state === "ready" &&
                          "border-success/20 bg-success/8 text-success",
                        product.state === "missing-file" &&
                          "border-destructive/20 bg-destructive/8 text-destructive",
                        (product.state === "draft" || product.state === "inactive") &&
                          "border-border bg-[var(--admin-raised)] text-muted-foreground",
                      )}
                    >
                      {product.state === "ready" && <Check className="size-3" aria-hidden />}
                      {product.state === "missing-file" && (
                        <FileWarning className="size-3" aria-hidden />
                      )}
                      {product.state === "ready"
                        ? "Ready"
                        : product.state === "missing-file"
                          ? "Missing file"
                          : product.state === "draft"
                            ? "Draft, no file"
                            : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSection>

      {/* ---- Recent activity ----------------------------------------------- */}
      <AdminSection
        title="Recent delivery activity"
        description="Grants, revocations and the most recent use of each download."
        className="admin-rise"
        style={step(7)}
        bodyClassName="p-0"
      >
        {activity.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={PackageCheck}
            title="No recent activity"
            description="Delivery activity will appear here as customers receive and access products."
          />
        ) : (
          <ul className="divide-y divide-border">
            {activity.map((entry, index) => (
              <li
                key={entry.id}
                className="admin-rise flex items-start gap-3.5 px-5 py-3.5"
                style={step(index)}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border",
                    entry.kind === "granted" && "border-success/25 bg-success/8 text-success",
                    entry.kind === "revoked" &&
                      "border-destructive/25 bg-destructive/8 text-destructive",
                    entry.kind === "downloaded" &&
                      "border-border bg-[var(--admin-raised)] text-muted-foreground",
                  )}
                >
                  {entry.kind === "granted" && <PackageCheck className="size-3.5" />}
                  {entry.kind === "revoked" && <ShieldX className="size-3.5" />}
                  {entry.kind === "downloaded" && <Download className="size-3.5" />}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {entry.kind === "granted"
                      ? "Access granted"
                      : entry.kind === "revoked"
                        ? "Access revoked"
                        : "Last downloaded"}
                  </p>
                  <p className="mt-0.5 break-words text-xs text-muted-foreground">
                    {entry.product}
                    {entry.detail && <> · {entry.detail}</>}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground/80">
                    <Link
                      href={`/admin/orders/${entry.orderNumber}`}
                      className="admin-mono break-all hover:text-brand-700"
                    >
                      {entry.orderNumber}
                    </Link>
                    <span aria-hidden className="text-muted-foreground/40">·</span>
                    <time dateTime={entry.at.toISOString()} className="tabular-nums">
                      {entry.at.toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      {/* Products that would fail a sale made right now get a direct route to
          the fix, rather than only appearing as a row in the table above. */}
      {notReady.length > 0 && (
        <Link
          href="/admin/products?fileState=unsellable"
          className="admin-rise group flex items-center gap-3 rounded-md border border-warning/25 bg-warning/[0.06] px-4 py-3 text-sm transition-colors duration-150 hover:bg-warning/10"
          style={step(8)}
        >
          <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 text-foreground">
            <span className="font-semibold tabular-nums">{notReady.length}</span>{" "}
            published {notReady.length === 1 ? "product has" : "products have"} no file
            attached and cannot be delivered.
          </span>
          <ArrowRight
            className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      )}
    </div>
  );
}
