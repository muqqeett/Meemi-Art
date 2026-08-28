import Image from "next/image";
import { Star } from "lucide-react";

import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { staggerStep } from "@/lib/motion";

type Review = {
  id: string;
  rating: number;
  title: string;
  body: string;
  createdAt: Date;
  user: { name: string | null; image: string | null };
};

/**
 * "Product Reviews" — Figma 57:1529.
 *
 *   heading  Clash Grotesk Semibold 28/1.2, #141414
 *   panel    0.8px dashed #B8B8B8, 8px radius, 23.2 padding
 *   gauge    84px ring showing the average, value in Semibold 20/1.4
 *   bars     8px tall, #E4E9EE track, #292929 fill, 8px radius, 12 apart
 *
 * Built from what the database holds: rating, title, body, date and author.
 * The design's filter sidebar, "With Photo & Video" tabs and helpful/unhelpful
 * vote counts are absent because nothing behind them exists — controls that
 * filter on data a review has never carried would return the same list every
 * time, and a vote button with no vote to record is a dead control.
 *
 * The distribution is computed from the reviews actually shown, and says so,
 * rather than implying it covers every review ever left.
 */

/** The ring. A conic gradient rather than an SVG arc — one element, no path maths. */
function RatingGauge({ average }: { average: number }) {
  const fraction = Math.max(0, Math.min(1, average / 5));

  return (
    <div
      className="relative grid size-[84px] shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(var(--color-pdp-star) ${fraction * 360}deg, var(--color-pdp-track) 0deg)`,
      }}
    >
      <span className="grid size-[68px] place-items-center rounded-full bg-white">
        <span className="font-clash text-xl leading-[1.4] font-semibold text-pdp-ink">
          {average.toFixed(1)}
        </span>
      </span>
    </div>
  );
}

function Stars({ value, size = 20 }: { value: number; size?: number }) {
  return (
    <span className="flex gap-1" aria-hidden>
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          style={{ width: size, height: size }}
          className={
            step <= Math.round(value)
              ? "shrink-0 fill-pdp-star text-pdp-star"
              : "shrink-0 fill-pdp-track text-pdp-track"
          }
        />
      ))}
    </span>
  );
}

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PdpReviews({
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
      <section id="reviews" className="w-full scroll-mt-24">
        <h2 className="font-clash text-2xl leading-[1.2] font-semibold text-pdp-price sm:text-[1.75rem]">
          Product Reviews
        </h2>
        <div className="mt-6 rounded-[8px] border-[0.8px] border-dashed border-pdp-border px-6 py-12 text-center">
          <p className="font-clash text-base text-pdp-body">
            No reviews yet. Reviews are written by customers after their order arrives.
          </p>
        </div>
      </section>
    );
  }

  const buckets = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((review) => review.rating === star).length,
  }));
  const shown = reviews.length;

  return (
    <section id="reviews" className="w-full scroll-mt-24">
      <Reveal>
        <h2 className="font-clash text-2xl leading-[1.2] font-semibold text-pdp-price sm:text-[1.75rem]">
          Product Reviews
        </h2>
      </Reveal>

      <Reveal>
        <div className="mt-[52px] flex flex-col gap-8 rounded-[8px] border-[0.8px] border-dashed border-pdp-border p-[23px] lg:flex-row lg:gap-[100px]">
          <div className="flex shrink-0 items-center gap-4">
            <RatingGauge average={average} />
            <div className="flex flex-col gap-2">
              <Stars value={average} />
              <p className="font-clash text-base leading-[1.6] text-pdp-meta">
                from {count.toLocaleString("en-US")}{" "}
                {count === 1 ? "review" : "reviews"}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {buckets.map((bucket) => (
              <div key={bucket.star} className="flex items-center gap-4">
                <span className="flex shrink-0 items-center gap-1">
                  <span className="font-clash text-base leading-[1.6] font-medium text-pdp-ink">
                    {bucket.star}.0
                  </span>
                  <Star className="size-5 fill-pdp-star text-pdp-star" aria-hidden />
                </span>

                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-[8px] bg-pdp-track">
                  <span
                    className="block h-2 rounded-[8px] bg-pdp-title"
                    style={{ width: `${shown === 0 ? 0 : (bucket.count / shown) * 100}%` }}
                  />
                </span>

                <span className="font-clash w-10 shrink-0 text-base leading-[1.6] font-medium text-pdp-ink tabular-nums">
                  {bucket.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Says what the bars are counting. With a page of reviews rather than
          all of them, an unlabelled distribution reads as the whole picture. */}
      {count > shown && (
        <p className="font-clash mt-3 text-sm text-pdp-subtle">
          Distribution shown across the {shown} most recent reviews.
        </p>
      )}

      <RevealGroup step={staggerStep.small} as="ul" className="mt-10 flex flex-col gap-8">
        {reviews.map((review) => (
          <RevealItem as="li" key={review.id}>
            <article className="flex flex-col gap-3 border-b border-pdp-hairline pb-8 last:border-0">
              <Stars value={review.rating} size={18} />
              <span className="sr-only">{review.rating} out of 5</span>

              <h3 className="font-clash text-lg leading-[1.4] font-semibold text-pdp-title">
                {review.title}
              </h3>

              <p className="font-clash text-base leading-[1.6] whitespace-pre-line text-pdp-body">
                {review.body}
              </p>

              <div className="mt-1 flex items-center gap-3">
                <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-pdp-surface">
                  {review.user.image ? (
                    <Image
                      src={review.user.image}
                      alt=""
                      fill
                      sizes="36px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="font-clash text-xs font-semibold text-pdp-meta">
                      {initials(review.user.name)}
                    </span>
                  )}
                </span>

                <span className="font-clash text-base leading-[1.6] font-medium text-pdp-title">
                  {review.user.name ?? "Verified buyer"}
                </span>

                <span aria-hidden className="size-1 rounded-full bg-pdp-border" />

                <time
                  dateTime={review.createdAt.toISOString()}
                  className="font-clash text-base leading-[1.6] text-pdp-subtle"
                >
                  {review.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}
                </time>
              </div>
            </article>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
