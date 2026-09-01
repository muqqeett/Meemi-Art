"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  EyeOff,
  Star,
  Trash2,
  Loader2,
  ExternalLink,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StarRating } from "@/components/brand/star-rating";
import { StatusBadge } from "@/components/admin/admin-primitives";
import {
  deleteReview,
  moderateReviews,
  setReviewFeatured,
  setReviewStatus,
} from "@/lib/actions/admin/reviews";
import type { ReviewStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

/**
 * The moderation table.
 *
 * Client-side because selection spans rows and the bulk bar has to know about
 * all of them. Everything it renders comes from the server as props — no
 * fetching here, and `router.refresh()` after a mutation re-runs the server
 * query rather than this component patching its own copy of the data.
 *
 * Approve, reject and feature are one click with no confirmation: each is
 * instantly reversible, and a dialog in front of a reversible action trains
 * people to dismiss dialogs. Delete is the only irreversible action and is the
 * only one that asks.
 */

export type ModerationRow = {
  id: string;
  rating: number;
  title: string;
  body: string;
  status: ReviewStatus;
  featured: boolean;
  createdAt: string;
  product: { name: string; slug: string };
  user: { id: string; name: string | null; email: string } | null;
};

function statusTone(status: ReviewStatus) {
  if (status === "APPROVED") return "positive" as const;
  if (status === "REJECTED") return "critical" as const;
  return "pending" as const;
}

export function ReviewModerationTable({ reviews }: { reviews: ModerationRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<ModerationRow | null>(null);

  const allSelected = reviews.length > 0 && selected.size === reviews.length;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) =>
      current.size === reviews.length ? new Set() : new Set(reviews.map((r) => r.id)),
    );
  }

  /** One place where every action reports its outcome and refreshes. */
  function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "That didn't work.");
        return;
      }
      if (result.message && result.message !== "No change.") toast.success(result.message);
      router.refresh();
    });
  }

  function bulk(status: ReviewStatus) {
    const ids = [...selected];
    run(async () => {
      const result = await moderateReviews(ids, status);
      if (result.ok) setSelected(new Set());
      return result;
    });
  }

  function remove(review: ModerationRow) {
    run(async () => {
      const result = await deleteReview(review.id);
      setConfirming(null);
      setSelected((current) => {
        const next = new Set(current);
        next.delete(review.id);
        return next;
      });
      return result;
    });
  }

  return (
    <>
      {/* The bulk bar takes the place of the toolbar rather than floating over
          the table, so nothing it covers can be mis-clicked underneath it. */}
      {selected.size > 0 && (
        <div className="admin-card mb-4 flex flex-wrap items-center gap-3 border-brand-200 bg-brand-50/60 px-4 py-2.5">
          <p className="text-sm font-medium text-brand-800 tabular-nums">
            {selected.size} selected
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="pillSm"
              disabled={pending}
              onClick={() => bulk("APPROVED")}
            >
              <Check aria-hidden />
              Approve
            </Button>
            <Button
              variant="outline"
              size="pillSm"
              disabled={pending}
              onClick={() => bulk("REJECTED")}
            >
              <EyeOff aria-hidden />
              Hide
            </Button>
            <Button
              variant="ghost"
              size="pillSm"
              disabled={pending}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="admin-card overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="admin-table min-w-[980px]">
            <caption className="sr-only">Customer reviews</caption>
            <thead>
              <tr>
                <th scope="col" className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select every review on this page"
                  />
                </th>
                <th scope="col">
                  Product
                </th>
                <th scope="col">
                  Customer
                </th>
                <th scope="col">
                  Rating
                </th>
                <th scope="col">
                  Review
                </th>
                <th scope="col">
                  Status
                </th>
                <th scope="col">
                  Date
                </th>
                <th scope="col" className="text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {reviews.map((review) => (
                <tr
                  key={review.id}
                  // Hover is `.admin-table`'s; selection has to beat it, so it
                  // is declared here and wins on specificity of intent.
                  className={cn(selected.has(review.id) && "bg-brand-50/70")}
                >
                  <td>
                    <Checkbox
                      checked={selected.has(review.id)}
                      onCheckedChange={() => toggle(review.id)}
                      aria-label={`Select review “${review.title}”`}
                    />
                  </td>

                  <td>
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

                  <td>
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

                  <td>
                    <StarRating value={review.rating} size="sm" />
                  </td>

                  <td className="max-w-sm">
                    <span className="block font-medium text-foreground">
                      {review.title}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {review.body}
                    </span>
                  </td>

                  <td>
                    <StatusBadge tone={statusTone(review.status)}>
                      {review.status.toLowerCase()}
                    </StatusBadge>
                    {review.featured && (
                      <span className="mt-1 flex items-center gap-1 text-xs text-brand-700">
                        <Star className="size-3 fill-current" aria-hidden />
                        Featured
                      </span>
                    )}
                  </td>

                  <td className="text-muted-foreground">
                    <time dateTime={review.createdAt}>
                      {new Date(review.createdAt).toLocaleDateString("en-US", {
                        dateStyle: "medium",
                      })}
                    </time>
                  </td>

                  <td>
                    <div className="flex justify-end gap-0.5">
                      {review.status !== "APPROVED" ? (
                        <Button
                          variant="ghost"
                          size="icon-lg"
                          disabled={pending}
                          onClick={() => run(() => setReviewStatus(review.id, "APPROVED"))}
                          className="text-muted-foreground hover:text-success"
                          aria-label={`Approve review “${review.title}”`}
                          title="Approve — show on the product page"
                        >
                          <Check aria-hidden />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon-lg"
                          disabled={pending}
                          onClick={() => run(() => setReviewStatus(review.id, "REJECTED"))}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Hide review “${review.title}”`}
                          title="Hide from the storefront — the text is kept"
                        >
                          <EyeOff aria-hidden />
                        </Button>
                      )}

                      {review.status === "REJECTED" && (
                        <Button
                          variant="ghost"
                          size="icon-lg"
                          disabled={pending}
                          onClick={() => run(() => setReviewStatus(review.id, "PENDING"))}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Move review “${review.title}” back to the queue`}
                          title="Back to the queue"
                        >
                          <Undo2 aria-hidden />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon-lg"
                        disabled={pending || review.status !== "APPROVED"}
                        onClick={() =>
                          run(() => setReviewFeatured(review.id, !review.featured))
                        }
                        className={cn(
                          "text-muted-foreground hover:text-brand-700",
                          review.featured && "text-brand-700",
                        )}
                        aria-pressed={review.featured}
                        aria-label={
                          review.featured
                            ? `Unpin review “${review.title}”`
                            : `Pin review “${review.title}” to the top`
                        }
                        title={
                          review.status === "APPROVED"
                            ? "Pin to the top of the product page"
                            : "Approve this review before featuring it"
                        }
                      >
                        <Star className={cn(review.featured && "fill-current")} aria-hidden />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-lg"
                        disabled={pending}
                        onClick={() => setConfirming(review)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Delete review “${review.title}”`}
                        title="Delete permanently"
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this review?</DialogTitle>
            <DialogDescription>
              “{confirming?.title}” on {confirming?.product.name} will be removed
              permanently and the product&apos;s rating recalculated. If you only
              want it off the storefront, hide it instead — that keeps the
              customer&apos;s words and can be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" size="pill" onClick={() => setConfirming(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              size="pill"
              disabled={pending}
              onClick={() => confirming && remove(confirming)}
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
