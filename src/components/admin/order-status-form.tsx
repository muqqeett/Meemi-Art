"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ban } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cancelUnpaidOrder } from "@/lib/actions/admin/catalog";
import type { OrderStatus } from "@/generated/prisma/enums";

/**
 * The only order state an admin may set by hand.
 *
 * Everything else is decided by the payment provider: PENDING becomes
 * COMPLETED when a signed webhook says money arrived, and REFUNDED when it
 * says money went back. A dropdown that let staff mark an order paid would be
 * a way to hand out files for free, and a "mark refunded" button would claim a
 * refund that no bank had actually made.
 *
 * What remains legitimate is abandoning an order that was never paid — tidying
 * a customer's history, not moving money.
 */
export function OrderStatusForm({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const canCancel = currentStatus === "PENDING" || currentStatus === "PROCESSING";

  function cancel() {
    startTransition(async () => {
      const result = await cancelUnpaidOrder(orderId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Order cancelled.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-body text-xs">
        Payment status is set by the provider&apos;s webhook and cannot be changed here.
        Refunds must be issued in the provider&apos;s dashboard; this order updates itself
        when the refund is confirmed.
      </p>

      {canCancel ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={cancel}
        >
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Ban aria-hidden />
          )}
          Cancel this unpaid order
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          No manual action is available for a {currentStatus.toLowerCase()} order.
        </p>
      )}
    </div>
  );
}
