import Link from "next/link";

import { StarRating } from "@/components/brand/star-rating";
import { SectionHeader } from "@/components/brand/section-header";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { staggerStep } from "@/lib/motion";

type FeaturedReview = {
  id: string;
  rating: number;
  title: string;
  body: string;
  createdAt: Date;
  user: { name: string | null };
  product: { name: string; slug: string };
};

type ReviewsSectionProps = {
  reviews: FeaturedReview[];
  summary: { average: number; count: number };
};

/**
 * Customer reviews, rendered from the `Review` table.
 *
 * Nothing here is invented: if there are no qualifying reviews the section is
 * omitted entirely rather than filled with placeholder praise.
 */
export function ReviewsSection({ reviews, summary }: ReviewsSectionProps) {
  if (reviews.length === 0) return null;

  return (
    <section className="section-y">
      <div className="container-page">
        <Reveal>
          <SectionHeader
            eyebrow="Reviews"
            title="What people say"
            description={
              summary.count > 0
                ? `${summary.average.toFixed(1)} average from ${summary.count} verified ${
                    summary.count === 1 ? "review" : "reviews"
                  }.`
                : undefined
            }
            align="start"
          />
        </Reveal>

        {/* Testimonials fade in place and stay put — nothing here rotates or
            auto-advances, because the reader has to be able to finish a
            sentence. */}
        <RevealGroup
          as="ul"
          step={staggerStep.medium}
          className="mt-10 grid gap-px overflow-hidden border border-border bg-border md:grid-cols-3"
        >
          {reviews.map((review) => (
            <RevealItem key={review.id} as="li" variant="in" className="bg-surface">
              <figure className="flex h-full flex-col p-7">
                <StarRating value={review.rating} size="sm" />

                <blockquote className="mt-5 flex-1">
                  <p className="font-display text-lg leading-snug">{review.title}</p>
                  <p className="text-body mt-3">{review.body}</p>
                </blockquote>

                <figcaption className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
                  <span className="block font-medium text-ink">
                    {review.user.name ?? "Verified buyer"}
                  </span>
                  <span className="mt-0.5 block">
                    on{" "}
                    <Link
                      href={`/products/${review.product.slug}`}
                      className="underline underline-offset-2 hover:text-brand-600"
                    >
                      {review.product.name}
                    </Link>
                  </span>
                </figcaption>
              </figure>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
