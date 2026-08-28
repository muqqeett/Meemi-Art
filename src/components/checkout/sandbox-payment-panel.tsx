"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X, Ban, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { formatMoney } from "@/lib/money";

type Outcome = "succeeded" | "failed" | "cancelled";

/**
 * The outcome picker on the sandbox payment page.
 *
 * Each button posts to a route that builds a *signed* webhook and delivers it
 * to the real endpoint. Nothing here writes to the order — the page only
 * reloads afterwards to show whatever the webhook decided, which is the same
 * thing a customer returning from a provider sees.
 *
 * The underpay button exists so the amount check can be exercised without
 * editing the database by hand; it should always end in a refused payment.
 */
export function SandboxPaymentPanel({
  orderId,
  orderNumber,
  totalCents,
  alreadyComplete,
}: {
  orderId: string;
  orderNumber: string;
  totalCents: number;
  alreadyComplete: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function send(outcome: Outcome, amountCents?: number, label?: string) {
    setPending(label ?? outcome);
    setNote(null);

    try {
      await fetch("/api/payments/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, outcome, amountCents }),
      });

      if (outcome === "succeeded" && amountCents === undefined) {
        router.push(`/orders/${orderNumber}?from=payment`);
        return;
      }

      setNote("Webhook delivered. Reload or open the order to see the result.");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  if (alreadyComplete) {
    return (
      <div className="mt-6 space-y-4">
        <p className="border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          This order is already paid. Sending another event would be ignored as a
          duplicate.
        </p>
        <ButtonLink href={`/orders/${orderNumber}`} variant="brand" size="pill">
          View the order
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <Button
        type="button"
        variant="brand"
        size="pillLg"
        className="w-full"
        disabled={pending !== null}
        onClick={() => send("succeeded")}
      >
        {pending === "succeeded" ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <Check aria-hidden />
        )}
        Pay {formatMoney(totalCents)}
      </Button>

      <div className="grid gap-3 sm:grid-cols-3">
        <Button
          type="button"
          variant="outline"
          disabled={pending !== null}
          onClick={() => send("failed")}
        >
          <X aria-hidden />
          Decline
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={pending !== null}
          onClick={() => send("cancelled")}
        >
          <Ban aria-hidden />
          Cancel
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={pending !== null}
          onClick={() => send("succeeded", 1, "underpay")}
        >
          <TriangleAlert aria-hidden />
          Underpay
        </Button>
      </div>

      {note && (
        <p role="status" className="text-body text-xs">
          {note}
        </p>
      )}
    </div>
  );
}
