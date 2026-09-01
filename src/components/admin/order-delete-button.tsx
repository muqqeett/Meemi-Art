"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { deleteAdminOrder } from "@/lib/actions/admin/orders";

/**
 * Delete one unpaid order.
 *
 * Two deliberate frictions, because this is the only irreversible action in the
 * order screens:
 *
 *  1. A dialog, so the destructive step is never one click from a table row.
 *  2. The order number typed out in full. Approve/reject actions elsewhere in
 *     the admin are one click precisely because they are reversible; this is
 *     not, and matching the number means an admin cannot delete the wrong row
 *     by muscle memory.
 *
 * The button is only rendered for orders the server would accept — but the
 * server re-checks every rule regardless. This component is convenience, not
 * the security boundary.
 */
export function OrderDeleteButton({
  orderId,
  orderNumber,
  /** `row` sits in a table cell; `detail` sits in the order's action panel. */
  variant = "row",
  /** Where to go afterwards. Detail pages must leave the deleted order. */
  redirectTo,
}: {
  orderId: string;
  orderNumber: string;
  variant?: "row" | "detail";
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();

  const matches = confirmation.trim() === orderNumber;

  function close() {
    setOpen(false);
    // Cleared on close so reopening never arrives pre-armed.
    setConfirmation("");
  }

  function remove() {
    if (!matches) return;

    startTransition(async () => {
      const result = await deleteAdminOrder(orderId);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      close();
      toast.success(result.message ?? "Test order deleted successfully.");

      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      } else {
        // The list is a server component; refreshing re-runs its query so the
        // row disappears rather than being hidden client-side.
        router.refresh();
      }
    });
  }

  return (
    <>
      {variant === "row" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => setOpen(true)}
          aria-label={`Delete order ${orderNumber}`}
          title="Delete test order"
        >
          <Trash2 aria-hidden />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-destructive/30 text-destructive hover:border-destructive/50 hover:bg-destructive/5"
          onClick={() => setOpen(true)}
        >
          <Trash2 aria-hidden />
          Delete order
        </Button>
      )}

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete test order?</DialogTitle>
            <DialogDescription>
              This will permanently remove{" "}
              <span className="font-mono font-medium text-foreground">{orderNumber}</span>{" "}
              and its associated order records. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-order-number" className="text-[0.8125rem]">
              Type{" "}
              <span className="font-mono font-medium text-foreground">{orderNumber}</span>{" "}
              to confirm
            </Label>
            <Input
              id="confirm-order-number"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              onKeyDown={(event) => {
                // Enter submits only once the number matches, so the key that
                // dismisses most dialogs cannot delete anything on its own.
                if (event.key === "Enter" && matches && !pending) {
                  event.preventDefault();
                  remove();
                }
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder={orderNumber}
              className="h-10 rounded-md font-mono"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="pillSm" onClick={close}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="pillSm"
              onClick={remove}
              disabled={!matches || pending}
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Delete order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
