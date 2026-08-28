import "server-only";

import { prisma } from "@/lib/prisma";
import { paymentConfig, paymentUrl, productionSafetyProblem } from "@/lib/payments/config";
import { getPaymentProvider } from "@/lib/payments/payment-service";
import { paddleApi } from "@/lib/payments/paddle-api";

/**
 * Payment status for admin settings.
 *
 * Reports only what an operator needs to see. No key, no secret, and no
 * partial key — a masked credential is still a credential leak in a
 * screenshot. Every credential field here is a boolean or a verdict, never a
 * value.
 *
 * The counts come from the database, so they describe what verified webhooks
 * actually did. There is deliberately no way to change any of them from this
 * screen: an admin can see that an order is unpaid, and cannot decide that it
 * is paid. That authority belongs to a signed Paddle event alone.
 */

export type PaymentsOverview = {
  provider: string;
  driver: string;
  environment: "sandbox" | "production" | "n/a";
  isConfigured: boolean;
  isTestMode: boolean;
  currency: string;
  webhookUrl: string;
  apiBase: string;
  /** Credential presence — never the credentials themselves. */
  credentials: { apiKey: boolean; webhookSecret: boolean; clientToken: boolean };
  /** Environment the client token implies, and whether it agrees with the server. */
  clientTokenEnv: "production" | "sandbox" | "unknown";
  envMismatch: boolean;
  /** Named blockers preventing a working checkout. Empty when ready. */
  problems: string[];
  /** Result of an authenticated ping, so a wrong-environment key shows up. */
  apiCheck: { ok: true } | { ok: false; reason: string } | { ok: "skipped" };
  catalog: { sellable: number; synced: number; drifted: number };
  payments: { paid: number; pending: number; processing: number; failed: number; refunded: number };
  orders: { completed: number; pending: number };
  /** Webhook deliveries actually received, which is the only proof it is wired. */
  webhookEvents: { total: number; lastAt: Date | null };
  requiredVars: string;
  hint: string;
};

export async function describePayments(): Promise<PaymentsOverview> {
  const provider = getPaymentProvider();
  const isPaddle = provider.name === "paddle";

  const [
    sellable,
    synced,
    driftedRows,
    paymentGroups,
    completedOrders,
    pendingOrders,
    webhookTotal,
    lastEvent,
    apiCheck,
  ] = await Promise.all([
    prisma.product.count({ where: { isActive: true, asset: { isNot: null } } }),
    prisma.product.count({
      where: { isActive: true, asset: { isNot: null }, paddlePriceId: { not: null } },
    }),
    prisma.product.findMany({
      where: { isActive: true, asset: { isNot: null } },
      select: { priceCents: true, paddlePriceCents: true },
    }),
    prisma.payment.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.count({ where: { status: "COMPLETED" } }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.paymentEvent.count({ where: { provider: provider.name } }),
    prisma.paymentEvent.findFirst({
      where: { provider: provider.name },
      orderBy: { processedAt: "desc" },
      select: { processedAt: true },
    }),
    isPaddle && paddleApi.isConfigured
      ? paddleApi.check()
      : Promise.resolve({ ok: "skipped" as const }),
  ]);

  const countFor = (status: string) =>
    paymentGroups.find((row) => row.status === status)?._count._all ?? 0;

  /**
   * Everything standing between this configuration and a working checkout,
   * named rather than implied. Each line is actionable and none of them prints
   * a credential — only whether one is present.
   */
  const problems: string[] = [];

  // Production safety first: it is the one that means real customers could be
  // handed files for free, so it leads the list.
  const safety = productionSafetyProblem();
  if (safety) problems.push(safety);

  if (isPaddle) {
    if (!paymentConfig.paddle.apiKey) problems.push("PADDLE_API_KEY is not set.");
    if (!paymentConfig.paddle.webhookSecret) {
      problems.push("PADDLE_WEBHOOK_SECRET is not set.");
    }
    if (!paymentConfig.paddle.clientToken) {
      problems.push("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not set — the overlay cannot open.");
    } else if (paymentConfig.paddle.envMismatch) {
      problems.push(
        `Environment mismatch: PADDLE_ENV is "${paymentConfig.paddle.env}" but the client token is a ${paymentConfig.paddle.tokenEnv} token. Checkout is refused until they match.`,
      );
    } else if (paymentConfig.paddle.tokenEnv === "unknown") {
      problems.push(
        "The client token has no test_/live_ prefix — Paddle.js may open the wrong environment.",
      );
    }
    if (apiCheck !== null && typeof apiCheck === "object" && "ok" in apiCheck && apiCheck.ok === false) {
      problems.push(apiCheck.reason);
    }
    if (sellable > 0 && synced < sellable) {
      problems.push(`${sellable - synced} sellable product(s) not synced to Paddle.`);
    }
  } else if (paymentConfig.paddle.env === "production") {
    problems.push(
      'PADDLE_ENV is "production" but PAYMENT_PROVIDER is not "paddle" — the local sandbox driver is still handling checkout and no money can move.',
    );
  }

  return {
    provider: provider.label,
    driver: provider.name,
    environment: isPaddle ? paymentConfig.paddle.env : "n/a",
    isConfigured: provider.isConfigured,
    isTestMode: provider.isTestMode,
    currency: paymentConfig.currency,
    webhookUrl: paymentUrl("/api/payments/webhook"),
    apiBase: isPaddle ? paymentConfig.paddle.apiBase : "n/a",
    credentials: {
      apiKey: Boolean(paymentConfig.paddle.apiKey),
      webhookSecret: Boolean(paymentConfig.paddle.webhookSecret),
      clientToken: Boolean(paymentConfig.paddle.clientToken),
    },
    apiCheck: apiCheck as PaymentsOverview["apiCheck"],
    clientTokenEnv: paymentConfig.paddle.tokenEnv,
    envMismatch: paymentConfig.paddle.envMismatch,
    problems,
    catalog: {
      sellable,
      synced,
      drifted: driftedRows.filter((row) => row.paddlePriceCents !== row.priceCents).length,
    },
    payments: {
      paid: countFor("PAID"),
      pending: countFor("PENDING"),
      processing: countFor("PROCESSING"),
      failed: countFor("FAILED"),
      refunded: countFor("REFUNDED"),
    },
    orders: { completed: completedOrders, pending: pendingOrders },
    webhookEvents: { total: webhookTotal, lastAt: lastEvent?.processedAt ?? null },
    requiredVars: isPaddle
      ? "PADDLE_ENV, PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET, NEXT_PUBLIC_PADDLE_CLIENT_TOKEN"
      : "None — the sandbox driver needs no credentials.",
    hint: !isPaddle
      ? "Sandbox driver: the full order, webhook and download pipeline runs, but no money moves. Set PAYMENT_PROVIDER=paddle to use Paddle."
      : !provider.isConfigured
        ? "Paddle selected but not configured — checkout refuses rather than taking an order it cannot charge."
        : provider.isTestMode
          ? "Paddle sandbox. Real API calls against test money; use Paddle's test cards."
          : "Paddle production. Live money.",
  };
}
