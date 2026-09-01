import "server-only";

import { siteConfig } from "@/lib/config";

/**
 * Payment environment, read once on the server.
 *
 * No secret is exported. `paddleApiKey` and `paddleWebhookSecret` are read
 * here and consumed inside the driver in this same server-only module tree;
 * nothing serialises them, and `check-bundle-secrets.ts` asserts they never
 * reach a client chunk.
 *
 * The one value that is deliberately public is the Paddle client token — it is
 * designed to be embedded in a page and cannot authorise a charge on its own.
 */

/** Which driver is active. `sandbox` needs no credentials and charges nobody. */
const driver = (process.env.PAYMENT_PROVIDER ?? "sandbox").toLowerCase();

/**
 * Paddle's environment is a deployment-wide switch, not a per-request one.
 * Anything other than an explicit "production" is treated as sandbox, so a
 * missing variable can never accidentally point at live money.
 */
const paddleEnv =
  (process.env.PADDLE_ENV ?? "sandbox").toLowerCase() === "production"
    ? "production"
    : "sandbox";

const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";

/**
 * Which Paddle account the *browser* will talk to.
 *
 * Paddle prefixes its client-side tokens by environment — `test_` for sandbox,
 * `live_` for production — and Paddle.js picks its environment from that. So
 * the token, not `PADDLE_ENV`, decides where the checkout overlay points.
 *
 * That makes a mismatch possible and silent: a server on `PADDLE_ENV=production`
 * creating live transactions while the browser opens them against sandbox, or
 * the reverse. Either way the customer meets a checkout that cannot find their
 * transaction. `paddleEnvMismatch` below turns that into a clean refusal
 * instead of a broken payment page.
 */
const tokenEnv: "production" | "sandbox" | "unknown" = clientToken.startsWith("live_")
  ? "production"
  : clientToken.startsWith("test_")
    ? "sandbox"
    : "unknown";

/** True when the server and the browser would be pointed at different accounts. */
const paddleEnvMismatch = tokenEnv !== "unknown" && tokenEnv !== paddleEnv;

export const paymentConfig = {
  driver,
  paddle: {
    env: paddleEnv,
    apiKey: process.env.PADDLE_API_KEY ?? "",
    webhookSecret: process.env.PADDLE_WEBHOOK_SECRET ?? "",
    clientToken,
    /** Environment implied by the client token's prefix. */
    tokenEnv,
    /** Server env and client token disagree — checkout must refuse. */
    envMismatch: paddleEnvMismatch,
    apiBase:
      paddleEnv === "production"
        ? "https://api.paddle.com"
        : "https://sandbox-api.paddle.com",
  },
  /**
   * Currency every order is priced in. Paddle is the merchant of record and
   * settles in the seller's payout currency, so this is what the customer is
   * quoted, not what lands in the bank.
   */
  currency: (process.env.PAYMENT_CURRENCY ?? "USD").toUpperCase(),
  /** Absolute base for return URLs handed to the provider. */
  appUrl: (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.SITE_URL ??
    siteConfig.url
  ).replace(/\/+$/, ""),
} as const;

/** Absolute URL builder for provider return links. */
export function paymentUrl(path: string): string {
  return `${paymentConfig.appUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Is this deployment serving real customers?
 *
 * Two independent signals, either of which is enough. `PADDLE_ENV=production`
 * is an explicit statement of intent. A production Node build on a non-local
 * origin is the implicit case — the one that catches a deploy where the Paddle
 * variables were simply forgotten.
 */
const looksLikeProduction =
  paddleEnv === "production" ||
  (process.env.NODE_ENV === "production" &&
    !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$|\/)/i.test(paymentConfig.appUrl));

export const productionDeployment = looksLikeProduction;

/**
 * The reason this deployment must not take an order, or null when it may.
 *
 * The failure this exists to prevent is the quiet one. The built-in sandbox
 * driver reports itself as configured and runs the entire pipeline — order,
 * signed webhook, access grant, download — while moving no money. On a
 * developer's machine that is the point. On meemiart.com it would hand real
 * customers real files for free, and every dashboard would look healthy.
 *
 * So a production deployment that has not selected Paddle is refused outright
 * rather than silently falling back, and Paddle itself is refused unless it is
 * completely configured. Checkout surfaces this as an ordinary "payments are
 * unavailable" message; the operator sees the specific cause in admin settings
 * and in the server log.
 */
export function productionSafetyProblem(): string | null {
  if (!looksLikeProduction) return null;

  if (driver !== "paddle") {
    return `This deployment looks like production (${paymentConfig.appUrl}) but PAYMENT_PROVIDER is "${driver || "unset"}". The built-in sandbox driver takes no money and must never serve real customers. Set PAYMENT_PROVIDER=paddle.`;
  }

  if (paddleEnv !== "production") {
    return 'PAYMENT_PROVIDER is "paddle" on a production deployment but PADDLE_ENV is not "production" — checkout would be pointed at sandbox-api.paddle.com.';
  }

  const missing = [
    !paymentConfig.paddle.apiKey && "PADDLE_API_KEY",
    !paymentConfig.paddle.webhookSecret && "PADDLE_WEBHOOK_SECRET",
    !clientToken && "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
  ].filter(Boolean) as string[];

  if (missing.length > 0) {
    return `Live Paddle configuration is incomplete — missing ${missing.join(", ")}.`;
  }

  if (paddleEnvMismatch) {
    return `PADDLE_ENV is "production" but the client token is a ${tokenEnv} token. The browser and the server would talk to different Paddle accounts.`;
  }

  return null;
}
