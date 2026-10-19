"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X, Ban, TriangleAlert } from "lucide-react";

import { PlumButtonLink, plumButtonClass } from "@/components/ui/plum-button";
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
        <p className="font-figtree rounded-[16px] border border-success/30 bg-success/5 px-4 py-3 text-sm leading-[22px] font-bold text-success">
          This order is already paid. Sending another event would be ignored as a
          duplicate.
        </p>
        <PlumButtonLink href={`/orders/${orderNumber}`} style="primary">
          View the order
        </PlumButtonLink>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <button
        type="button"
        className={plumButtonClass({ style: "buy", size: "lg", className: "w-full" })}
        disabled={pending !== null}
        onClick={() => send("succeeded")}
      >
        {pending === "succeeded" ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Check className="size-5" aria-hidden />
        )}
        Pay {formatMoney(totalCents)}
      </button>

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          className={plumButtonClass({ style: "secondary", size: "md" })}
          disabled={pending !== null}
          onClick={() => send("failed")}
        >
          <X className="size-4" aria-hidden />
          Decline
        </button>

        <button
          type="button"
          className={plumButtonClass({ style: "secondary", size: "md" })}
          disabled={pending !== null}
          onClick={() => send("cancelled")}
        >
          <Ban className="size-4" aria-hidden />
          Cancel
        </button>

        <button
          type="button"
          className={plumButtonClass({ style: "secondary", size: "md" })}
          disabled={pending !== null}
          onClick={() => send("succeeded", 1, "underpay")}
        >
          <TriangleAlert className="size-4" aria-hidden />
          Underpay
        </button>
      </div>

      {note && (
        <p role="status" className="font-figtree text-[13px] leading-[18px] font-medium text-pl-muted">
          {note}
        </p>
      )}
    </div>
  );
}
