import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";

import { AdminPageHeader, AdminTableCard } from "@/components/admin/admin-page-header";
import { AdminFilters } from "@/components/admin/admin-filters";
import { ReviewModerationTable } from "@/components/admin/review-moderation-table";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { EmptyState } from "@/components/brand/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { StarRating } from "@/components/brand/star-rating";
import { listAdminReviews, listReviewedProducts } from "@/lib/queries/admin";
import { buildBaseQuery, hasAnyParam } from "@/lib/shop-params";
import type { ReviewStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Reviews" };

const REVIEW_STATUSES = ["APPROVED", "PENDING", "REJECTED"] as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Narrows an untrusted URL value so a hand-edited `?status=` cannot reach Prisma. */
function parseStatus(value: string | undefined): ReviewStatus | undefined {
  return REVIEW_STATUSES.find((status) => status === value);
}

export default async function AdminReviewsPage({
  searchParams,
}: PageProps<"/admin/reviews">) {
  const raw = await searchParams;

  const ratingParam = Number(first(raw.rating));
  const rating = ratingParam >= 1 && ratingParam <= 5 ? ratingParam : undefined;

  const [
    { reviews, page, pageCount, distribution, statusCounts, average },
    products,
  ] = await Promise.all([
    listAdminReviews({
      q: first(raw.q),
      rating,
      productId: first(raw.productId),
      status: parseStatus(first(raw.status)),
      page: Number(first(raw.page)) || 1,
    }),
    listReviewedProducts(),
  ]);

  const distributionTotal = distribution.reduce((sum, row) => sum + row.count, 0);
  const hidden =
    (statusCounts.find((row) => row.status === "REJECTED")?.count ?? 0) +
    (statusCounts.find((row) => row.status === "PENDING")?.count ?? 0);

  return (
    <div>
      <AdminPageHeader
        title="Reviews"
        description="Customer reviews across the shop. They can be approved, hidden or featured — never edited. The product rating recalculates on every change."
      />

      {distributionTotal > 0 && (
        <section
          aria-label="Rating summary"
          className="mb-6 flex flex-wrap items-center gap-8 rounded-xs border border-border bg-card p-5 shadow-card"
        >
          <div>
            <p className="font-display text-4xl text-brand-700">{average.toFixed(1)}</p>
            <StarRating value={average} size="sm" className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">
              {distributionTotal} {distributionTotal === 1 ? "review" : "reviews"}
            </p>
            {/* The average is what a shopper sees, so it counts only approved
                reviews. The spread below is every review, which is why the two
                can disagree — this says so rather than leaving it to be
                discovered. */}
            {hidden > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Average excludes {hidden} hidden
              </p>
            )}
          </div>

          <ul className="min-w-56 flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = distribution.find((row) => row.rating === star)?.count ?? 0;
              const share = distributionTotal > 0 ? (count / distributionTotal) * 100 : 0;

              return (
                <li key={star} className="flex items-center gap-3 text-xs">
                  <span className="w-8 text-muted-foreground">{star}★</span>
                  <span
                    className="h-1.5 max-w-64 flex-1 overflow-hidden bg-surface-deep"
                    role="img"
                    aria-label={`${count} ${star}-star ${count === 1 ? "review" : "reviews"}`}
                  >
                    <span
                      className="block h-full bg-brand-700"
                      style={{ width: `${share}%` }}
                    />
                  </span>
                  <span className="w-8 text-right tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <AdminFilters
        params={raw}
        searchPlaceholder="Search reviews, products or customers…"
        selects={[
          {
            name: "status",
            label: "Any status",
            options: REVIEW_STATUSES.map((status) => {
              const count = statusCounts.find((row) => row.status === status)?.count ?? 0;
              const label =
                status === "APPROVED" ? "Visible" : status === "REJECTED" ? "Hidden" : "Pending";
              return { value: status, label: `${label} (${count})` };
            }),
          },
          {
            name: "rating",
            label: "Any rating",
            options: [5, 4, 3, 2, 1].map((star) => ({
              value: String(star),
              label: `${star} star${star === 1 ? "" : "s"}`,
            })),
          },
          {
            name: "productId",
            label: "All products",
            options: products.map((product) => ({
              value: product.id,
              label: product.name,
            })),
          },
        ]}
      />

      {reviews.length === 0 ? (
        <AdminTableCard>
          {/* The filtered count cannot tell "no reviews at all" from "the
              filters excluded everything" — the URL can. */}
          {hasAnyParam(raw, ["q", "rating", "productId", "status"]) ? (
            <EmptyState
              variant="inline"
              icon={MessageSquare}
              title="No reviews match"
              description="Try a different search term, or clear the filters to see every review."
              action={
                <ButtonLink href="/admin/reviews" variant="brand" size="pill">
                  Clear filters
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              variant="inline"
              icon={MessageSquare}
              title="No reviews yet"
              description="Reviews left by customers on product pages will appear here for moderation."
            />
          )}
        </AdminTableCard>
      ) : (
        <>
          {/* Dates cross the server/client boundary as ISO strings and are
              formatted in the browser, so a row reads in the operator's own
              locale rather than the server's. */}
          <ReviewModerationTable
            reviews={reviews.map((review) => ({
              ...review,
              createdAt: review.createdAt.toISOString(),
            }))}
          />

          <PaginationNav
            page={page}
            pageCount={pageCount}
            baseQuery={buildBaseQuery(raw)}
            basePath="/admin/reviews"
          />
        </>
      )}
    </div>
  );
}
