import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare, ExternalLink } from "lucide-react";

import { AdminPageHeader, AdminTableCard } from "@/components/admin/admin-page-header";
import { AdminFilters } from "@/components/admin/admin-filters";
import { ReviewRowActions } from "@/components/admin/review-row-actions";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { EmptyState } from "@/components/brand/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { StarRating } from "@/components/brand/star-rating";
import { listAdminReviews, listReviewedProducts } from "@/lib/queries/admin";
import { buildBaseQuery, hasAnyParam } from "@/lib/shop-params";

export const metadata: Metadata = { title: "Reviews" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminReviewsPage({
  searchParams,
}: PageProps<"/admin/reviews">) {
  const raw = await searchParams;

  const ratingParam = Number(first(raw.rating));
  const rating = ratingParam >= 1 && ratingParam <= 5 ? ratingParam : undefined;

  const [{ reviews, total, page, pageCount, distribution, average }, products] =
    await Promise.all([
      listAdminReviews({
        q: first(raw.q),
        rating,
        productId: first(raw.productId),
        page: Number(first(raw.page)) || 1,
      }),
      listReviewedProducts(),
    ]);

  const distributionTotal = distribution.reduce((sum, row) => sum + row.count, 0);

  return (
    <div>
      <AdminPageHeader
        title="Reviews"
        description="Customer reviews across the shop. Reviews can be removed, never edited — the product rating updates automatically."
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
          {/* `total` is the filtered count, so it cannot tell "no reviews at
              all" from "the filters excluded everything" — the URL can. */}
          {hasAnyParam(raw, ["q", "rating", "productId"]) ? (
            <EmptyState
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
              icon={MessageSquare}
              title="No reviews yet"
              description="Reviews left by customers on product pages will appear here for moderation."
            />
          )}
        </AdminTableCard>
      ) : (
        <>
          <AdminTableCard>
            <table className="w-full min-w-[860px] text-sm">
              <caption className="sr-only">Customer reviews</caption>
              <thead className="bg-surface-alt text-left">
                <tr className="text-xs tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Customer
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Rating
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Review
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {reviews.map((review) => (
                  <tr key={review.id} className="hover:bg-surface-alt/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/products/${review.product.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-royal-600"
                      >
                        {review.product.name}
                        <ExternalLink className="size-3" aria-hidden />
                      </Link>
                    </td>

                    <td className="px-4 py-3">
                      {review.user ? (
                        <Link
                          href={`/admin/customers/${review.user.id}`}
                          className="font-medium text-foreground hover:text-royal-600"
                        >
                          {review.user.name ?? "Unnamed"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Deleted account</span>
                      )}
                      <span className="block truncate text-xs text-muted-foreground">
                        {review.user?.email}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <StarRating value={review.rating} size="sm" />
                    </td>

                    <td className="max-w-sm px-4 py-3">
                      <span className="block font-medium text-foreground">
                        {review.title}
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {review.body}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">
                      <time dateTime={review.createdAt.toISOString()}>
                        {review.createdAt.toLocaleDateString("en-US", {
                          dateStyle: "medium",
                        })}
                      </time>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <ReviewRowActions
                          review={{
                            id: review.id,
                            title: review.title,
                            productName: review.product.name,
                          }}
                        />
                      </div>
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
            basePath="/admin/reviews"
          />
        </>
      )}
    </div>
  );
}
