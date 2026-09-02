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
import { deleteEmailLogs } from "@/lib/actions/admin/email-logs";

/**
 * Clear the failed records the page is currently showing.
 *
 * `ids` is fixed at render: it is the exact set the page counted and the admin
 * can see, not a live "everything that failed" query. That is what keeps this
 * from becoming a standing rule — a failure recorded after this page loaded is
 * not in the list, is not deleted, and will still be there afterwards waiting
 * to be read.
 *
 * The count in the dialog comes from that same list, so the number confirmed is
 * the number removed.
 */
export function EmailLogBulkDelete({ ids }: { ids: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const count = ids.length;
  if (count === 0) return null;

  function remove() {
    startTransition(async () => {
      const result = await deleteEmailLogs(ids);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setOpen(false);
      toast.success(result.message ?? "Email records deleted.");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-destructive/30 text-destructive hover:border-destructive/50 hover:bg-destructive/5"
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden />
        Delete {count === 1 ? "failed record" : `${count} failed records`}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {count === 1
                ? "Delete 1 failed email record?"
                : `Delete ${count} failed email records?`}
            </DialogTitle>
            <DialogDescription>
              {count === 1 ? "This record is" : "These records are"} permanently
              removed from Email Health history. This does not resend any email,
              does not affect email delivery, and does not change the Resend
              configuration.
            </DialogDescription>
          </DialogHeader>

          {/* Said plainly, because the button's label cannot carry it: this
              deletes what is on screen now, not a category. */}
          <p className="rounded-lg border border-border bg-[var(--admin-raised)] px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            Only the {count === 1 ? "record" : `${count} records`} currently
            listed{" "}
            {count === 1 ? "is" : "are"} affected. Accepted emails are never
            touched, and any failure recorded after this page loaded is left in
            place.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="pillSm"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="pillSm"
              onClick={remove}
              disabled={pending}
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Delete records
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
