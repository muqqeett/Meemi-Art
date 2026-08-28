import Image from "next/image";

import { StarRating } from "@/components/brand/star-rating";

type Review = {
  id: string;
  rating: number;
  title: string;
  body: string;
  createdAt: Date;
  user: { name: string | null; image: string | null };
};

/**
 * Reviews for a single product, straight from the database.
 *
 * With none, it says so in one line rather than disappearing. A product page
 * that simply stops after the accordion reads as though something failed to
 * load; a shopper who knows there are no reviews yet has learned something
 * true, which is the most a page can offer here. Nothing is invented to fill
 * the space.
 */
export function ProductReviews({
  reviews,
  average,
  count,
}: {
  reviews: Review[];
  average: number;
  count: number;
}) {
  if (reviews.length === 0) {
    return (
      <section id="reviews" className="scroll-mt-24 border-t border-border py-16 lg:py-20">
        <div className="container-page">
          <div className="mx-auto max-w-md text-center">
            <p className="eyebrow justify-center">Reviews</p>
            <h2 className="heading-sub mt-4">No reviews yet</h2>
            <p className="text-body mt-3">
              This piece has not been reviewed. Reviews are written by customers after
              their order arrives.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Distribution across the reviews actually shown.
  const buckets = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((review) => review.rating === star).length,
  }));

  return (
    <section id="reviews" className="section-y scroll-mt-24 border-t border-border">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[300px_1fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="heading-section">Reviews</h2>

            <div className="mt-6 flex items-baseline gap-3">
              <span className="font-display text-5xl text-brand-700">
                {average.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">out of 5</span>
            </div>

            <StarRating value={average} size="md" className="mt-2" />
            <p className="mt-2 text-sm text-muted-foreground">
              {count} {count === 1 ? "review" : "reviews"}
            </p>

            <ul className="mt-6 space-y-2">
              {buckets.map((bucket) => {
                const share =
                  reviews.length > 0 ? (bucket.count / reviews.length) * 100 : 0;

                return (
                  <li key={bucket.star} className="flex items-center gap-3 text-xs">
                    <span className="w-8 text-muted-foreground">{bucket.star}★</span>
                    <span
                      className="h-1.5 flex-1 overflow-hidden bg-surface-deep"
                      role="img"
                      aria-label={`${bucket.count} ${bucket.star}-star ${
                        bucket.count === 1 ? "review" : "reviews"
                      }`}
                    >
                      <span
                        className="block h-full bg-brand-700"
                        style={{ width: `${share}%` }}
                      />
                    </span>
                    <span className="w-6 text-right text-muted-foreground tabular-nums">
                      {bucket.count}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <ul className="divide-y divide-border border-t border-border">
            {reviews.map((review) => (
              <li key={review.id} className="py-7 first:pt-0">
                <article>
                  <div className="flex items-center gap-3">
                    {review.user.image ? (
                      <Image
                        src={review.user.image}
                        alt=""
                        width={36}
                        height={36}
                        className="size-9 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="inline-flex size-9 items-center justify-center rounded-full bg-surface-deep text-xs font-semibold text-brand-700"
                      >
                        {(review.user.name ?? "?").charAt(0).toUpperCase()}
                      </span>
                    )}

                    <div>
                      <p className="text-sm font-medium">
                        {review.user.name ?? "Verified buyer"}
                      </p>
                      <time
                        dateTime={review.createdAt.toISOString()}
                        className="text-xs text-muted-foreground"
                      >
                        {review.createdAt.toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </time>
                    </div>
                  </div>

                  <StarRating value={review.rating} size="sm" className="mt-3" />
                  <h3 className="font-display mt-2 text-lg">{review.title}</h3>
                  <p className="text-body mt-1.5 max-w-2xl">{review.body}</p>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
