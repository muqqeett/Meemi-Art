"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { deleteReview } from "@/lib/actions/admin/reviews";

/**
 * Removal is the only moderation action offered. A shop that could edit the
 * text of a customer's review would be publishing fabricated testimony, so the
 * admin can take a review down but never rewrite it.
 */
export function ReviewRowActions({
  review,
}: {
  review: { id: string; title: string; productName: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function remove() {
    startTransition(async () => {
      const result = await deleteReview(review.id);
      setConfirmOpen(false);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Review removed.");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-lg"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
        aria-label={`Remove review “${review.title}”`}
        title="Remove review"
      >
        <Trash2 aria-hidden />
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this review?</DialogTitle>
            <DialogDescription>
              “{review.title}” on {review.productName} will be deleted and the
              product&apos;s rating recalculated. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" size="pill" onClick={() => setConfirmOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              size="pill"
              onClick={remove}
              disabled={pending}
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Remove review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
