"use client";

import { useState, useTransition } from "react";
import { Loader2, Link2, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { syncOneProductToPaddle } from "@/lib/actions/admin/paddle";

export type PaddleConnection = {
  paddleProductId: string | null;
  paddlePriceId: string | null;
  /** What Paddle was last told this product costs, in cents. */
  paddlePriceCents: number | null;
  paddleSyncedAt: Date | null;
};

/**
 * Connects one product to the Paddle catalogue, and says plainly whether it is.
 *
 * A product cannot be bought until it has a Paddle price id: checkout charges a
 * catalogue price rather than an amount sent from the browser, so an unsynced
 * product has no price Paddle would honour. Before this control existed the
 * only way to connect one was the account-wide sync on the settings page, which
 * gave no per-product feedback — a published product could sit there refusing
 * every purchase with nothing in the admin explaining why.
 *
 * Three states, because "connected" is not binary here:
 *
 *   not connected  no price id — the product cannot be sold
 *   out of step    the price changed since the last sync, so the catalogue
 *                  would charge a different amount than the order records;
 *                  checkout refuses this too rather than overcharging
 *   connected      ids present and the amount agrees
 *
 * The ids shown are identifiers, not secrets — Paddle prints them in its own
 * dashboard and they travel in checkout requests. The API key and webhook
 * secret are server-only and never reach this component.
 */
export function PaddleConnectionField({
  productId,
  priceCents,
  connection,
}: {
  productId: string | null;
  /** The product's current price, to detect drift against the synced amount. */
  priceCents: number;
  connection: PaddleConnection | null;
}) {
  const [pending, startTransition] = useTransition();
  const [ids, setIds] = useState({
    productId: connection?.paddleProductId ?? null,
    priceId: connection?.paddlePriceId ?? null,
  });
  const [syncedCents, setSyncedCents] = useState(connection?.paddlePriceCents ?? null);

  // A product that has not been saved yet has no id to sync against.
  if (!productId) {
    return (
      <p className="text-body text-sm">
        Save the product first — it needs to exist before it can be connected to a
        Paddle price.
      </p>
    );
  }

  const connected = Boolean(ids.priceId);
  const outOfStep = connected && syncedCents !== priceCents;

  function connect() {
    startTransition(async () => {
      const result = await syncOneProductToPaddle(productId!);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setIds({
        productId: result.paddleProductId ?? ids.productId,
        priceId: result.paddlePriceId ?? ids.priceId,
      });
      // The sync writes the current price as the synced amount, so the drift
      // warning clears without waiting for a refetch.
      setSyncedCents(priceCents);
      toast.success(result.message);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">Status</span>
        {outOfStep ? (
          <span className="text-warning inline-flex items-center gap-1.5 text-sm font-semibold">
            <AlertTriangle className="size-4" aria-hidden />
            Out of step — price changed since the last sync
          </span>
        ) : connected ? (
          <span className="text-success inline-flex items-center gap-1.5 text-sm font-semibold">
            <CheckCircle2 className="size-4" aria-hidden />
            Connected
          </span>
        ) : (
          <span className="text-warning inline-flex items-center gap-1.5 text-sm font-semibold">
            <AlertTriangle className="size-4" aria-hidden />
            Not connected
          </span>
        )}
      </div>

      {connected && (
        <dl className="grid gap-2 text-sm sm:grid-cols-[9rem_1fr]">
          <dt className="text-muted-foreground">Paddle product</dt>
          <dd className="font-mono text-xs break-all text-foreground">{ids.productId}</dd>
          <dt className="text-muted-foreground">Paddle price</dt>
          <dd className="font-mono text-xs break-all text-foreground">{ids.priceId}</dd>
        </dl>
      )}

      {!connected && (
        <p className="text-warning text-sm">
          This product cannot be purchased until it is connected to a Paddle price.
          Customers see &ldquo;isn&rsquo;t ready to buy yet&rdquo; at checkout.
        </p>
      )}

      {outOfStep && (
        <p className="text-warning text-sm">
          Paddle would charge{" "}
          {syncedCents === null ? "a different amount" : `$${(syncedCents / 100).toFixed(2)}`}{" "}
          but this product is priced at ${(priceCents / 100).toFixed(2)}. Checkout refuses
          the sale rather than charging the wrong amount — re-sync to update the Paddle
          price.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="pillSm"
          disabled={pending}
          onClick={connect}
        >
          {pending ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : connected ? (
            <RefreshCw className="mr-2 size-4" aria-hidden />
          ) : (
            <Link2 className="mr-2 size-4" aria-hidden />
          )}
          {pending
            ? "Working…"
            : connected
              ? "Re-sync with Paddle"
              : "Create Paddle Product & Price"}
        </Button>

        {connected && !outOfStep && connection?.paddleSyncedAt && (
          <span className="text-muted-foreground text-xs">
            Last synced {new Date(connection.paddleSyncedAt).toLocaleString()}
          </span>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        Creates a Paddle product and a one-time price — never a subscription. Pressing
        this again reuses the ids above rather than creating a duplicate.
      </p>
    </div>
  );
}
