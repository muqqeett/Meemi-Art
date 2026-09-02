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
import { deleteEmailLog } from "@/lib/actions/admin/email-logs";

/**
 * Delete one email-log record.
 *
 * A dialog stands between the click and the delete, because the row cannot be
 * recovered afterwards — but no type-to-confirm. That friction exists on order
 * deletion, where the wrong row means a customer's purchase disappears; here
 * the worst case is one line of history, and the dialog names the record so the
 * admin can see which one they are removing.
 *
 * The button is rendered only for records the server would accept. The server
 * re-checks anyway — this component is convenience, not the boundary.
 */
export function EmailLogDeleteButton({
  logId,
  template,
  status,
  to,
}: {
  logId: string;
  /** Already humanised by the page; shown to identify the record. */
  template: string;
  status: string;
  to: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteEmailLog(logId);

      if (!result.ok) {
        // The row stays exactly where it is: nothing is hidden optimistically,
        // so a failure leaves the table telling the truth.
        toast.error(result.error);
        return;
      }

      setOpen(false);
      toast.success(result.message ?? "Email record deleted.");
      // The page is a server component; refreshing re-runs its queries so the
      // row disappears and every count above it settles to the new total.
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${template} email record for ${to}`}
        title="Delete this record"
      >
        <Trash2 aria-hidden />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete email log?</DialogTitle>
            <DialogDescription>
              This permanently removes this entry from the admin history. It does
              not resend the email and does not affect email delivery.
            </DialogDescription>
          </DialogHeader>

          <dl className="space-y-2.5 rounded-lg border border-border bg-[var(--admin-raised)] px-4 py-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Template</dt>
              <dd className="mt-0.5 font-medium text-foreground">{template}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Recipient</dt>
              <dd className="mt-0.5 break-all text-foreground">{to}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="mt-0.5 font-medium text-foreground">{status}</dd>
            </div>
          </dl>

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
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
