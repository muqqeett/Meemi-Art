"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { syncCatalogToPaddle } from "@/lib/actions/admin/paddle";

/**
 * Pushes every sellable product to the Paddle catalogue.
 *
 * Idempotent by design — it reuses whatever Paddle ids each product already
 * carries and only writes what differs, so pressing it twice is harmless. It
 * creates products and one-time prices; it never touches a payment or an order.
 */
export function PaddleSyncButton({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending || disabled}
        onClick={() =>
          startTransition(async () => {
            const result = await syncCatalogToPaddle();
            if (result.ok) {
              setDone(result.message);
              toast.success(result.message);
            } else {
              setDone(null);
              toast.error(result.error);
            }
          })
        }
      >
        {pending ? (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
        ) : (
          <RefreshCw className="mr-2 size-4" aria-hidden />
        )}
        {pending ? "Syncing…" : "Sync catalogue to Paddle"}
      </Button>

      {done && (
        <p role="status" className="text-success text-xs">
          {done}
        </p>
      )}
    </div>
  );
}
