import { AlertTriangle } from "lucide-react";

import { paymentConfig } from "@/lib/payments/config";
import { getPaymentProvider } from "@/lib/payments";

/**
 * Says out loud when the store cannot take real money.
 *
 * The failure this prevents is the expensive one in the other direction: an
 * operator assuming they are in a test environment and putting a real card
 * through. So the rule is inverted from the obvious one — the banner is shown
 * whenever the store is *not* on live Paddle, and its absence is the signal
 * that money is real.
 *
 * Server-rendered from server-only config. The browser is never asked what
 * environment it is in, because the browser would only know what it was told.
 */
export function TestModeBanner() {
  const provider = getPaymentProvider();
  if (!provider.isTestMode) return null;

  const label =
    provider.name === "paddle"
      ? `Paddle Sandbox — test mode (${paymentConfig.paddle.apiBase.replace("https://", "")})`
      : "Sandbox payments — test mode";

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning px-4 py-1.5 text-center text-xs font-semibold text-near-black"
    >
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
      <span>
        {label}. No real payment is taken and test cards only.
      </span>
    </div>
  );
}
