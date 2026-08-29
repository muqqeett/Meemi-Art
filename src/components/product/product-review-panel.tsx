"use client";

import { useState } from "react";
import { PencilLine, Star } from "lucide-react";

import { ReviewForm } from "@/components/product/review-form";

/**
 * The review affordance on a product page.
 *
 * Rendered only when the server has established this signed-in customer has a
 * completed, paid order containing this product. That eligibility never
 * expires, so this panel is the customer's permanent route back to their
 * review — they do not have to find the original order to change it.
 *
 * Nothing here decides who may review. The server action re-checks the
 * purchase on every submit, so a panel that should not be on the page would
 * still be refused.
 */
export function ProductReviewPanel({
  productId,
  productName,
  existing,
}: {
  productId: string;
  productName: string;
  existing: { rating: number; title: string; body: string } | null;
}) {
  // Seeded from the server, then kept locally so the panel reflects a save
  // immediately rather than waiting on revalidation.
  const [current, setCurrent] = useState(existing);
  const [open, setOpen] = useState(false);

  const hasReview = current !== null;

  return (
    <div className="mt-6 rounded-[8px] border-[0.8px] border-dashed border-pdp-border p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-clash text-base leading-[1.6] font-medium text-pdp-title">
            {hasReview ? "Your Review" : "You bought this — how did it go?"}
          </p>
          <p className="font-clash mt-1 text-sm text-pdp-subtle">
            {hasReview
              ? "You can change your review whenever you like."
              : "Share what you made with it. There's no time limit."}
          </p>
        </div>

        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="label-caps inline-flex h-11 shrink-0 items-center gap-2 rounded-xs bg-brand-700 px-5 text-white transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
          >
            <PencilLine className="size-4" aria-hidden />
            {hasReview ? "Edit Review" : "Write a Review"}
          </button>
        )}
      </div>

      {/* A saved review stays visible while the form is closed, so "Your
          Review" is a state the customer can actually read, not just a label. */}
      {hasReview && !open && (
        <div className="mt-4 border-t border-pdp-hairline pt-4">
          <span className="flex gap-1" aria-hidden>
            {[1, 2, 3, 4, 5].map((step) => (
              <Star
                key={step}
                className={
                  step <= current.rating
                    ? "size-4 shrink-0 fill-pdp-star text-pdp-star"
                    : "size-4 shrink-0 fill-pdp-track text-pdp-track"
                }
              />
            ))}
          </span>
          <span className="sr-only">You rated this {current.rating} out of 5</span>

          <p className="font-clash mt-2 text-base leading-[1.4] font-semibold text-pdp-title">
            {current.title}
          </p>
          <p className="font-clash mt-1 text-base leading-[1.6] whitespace-pre-line text-pdp-body">
            {current.body}
          </p>
        </div>
      )}

      {open && (
        <div className="mt-5 border-t border-pdp-hairline pt-5">
          <ReviewForm
            productId={productId}
            productName={productName}
            existing={current}
            onDone={setCurrent}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-body mt-4 h-11 text-sm underline underline-offset-4 hover:text-pdp-title sm:h-auto"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
