"use client";

import { useState } from "react";
import { Star, PencilLine } from "lucide-react";

import { ReviewForm } from "@/components/product/review-form";
import { Button } from "@/components/ui/button";

/**
 * "Write a review" beside a purchased line on a completed order.
 *
 * Rendered only for lines the server has already established are reviewable —
 * the order is COMPLETED and PAID and belongs to the viewer. This component
 * decides nothing about eligibility; the server action re-checks it on submit,
 * so a button that should not be here would still be refused.
 */
export function OrderItemReview({
  productId,
  productName,
  existing,
}: {
  productId: string;
  productName: string;
  existing: { rating: number; title: string; body: string } | null;
}) {
  // Seeded from the server and then kept locally, so reopening the panel right
  // after saving prefills what was just written rather than an empty form.
  const [current, setCurrent] = useState(existing);
  const hasReview = current !== null;
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {hasReview && (
          <span className="text-success inline-flex items-center gap-1.5 text-sm font-medium">
            <Star className="size-4 fill-current" aria-hidden />
            Your Review
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          size="pillSm"
          className="h-11 sm:h-9"
          onClick={() => setOpen(true)}
        >
          <PencilLine className="mr-2 size-4" aria-hidden />
          {hasReview ? "Edit Review" : "Write a Review"}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-alt/40 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          {hasReview ? "Edit Review" : `Review ${productName}`}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="pillSm"
          className="h-11 sm:h-9"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>

      <ReviewForm
        productId={productId}
        productName={productName}
        existing={current}
        onDone={setCurrent}
      />
    </div>
  );
}
