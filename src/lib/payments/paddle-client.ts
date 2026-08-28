"use client";

import { initializePaddle, type Paddle } from "@paddle/paddle-js";

/**
 * Paddle.js, loaded on demand.
 *
 * The only Paddle value the browser is ever given is
 * `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`. It is designed to be public: it can open a
 * checkout for a transaction that already exists, and nothing else. It cannot
 * read the API, create a charge, price anything, or verify a webhook. The API
 * key and the webhook secret live only in server-only modules and are asserted
 * out of client bundles by `scripts/check-bundle-secrets.ts`.
 *
 * The environment is derived from the token itself: Paddle issues distinct
 * `test_`-prefixed tokens for sandbox, so a live token cannot be opened against
 * the sandbox or the reverse.
 *
 * Loaded lazily rather than in the root layout — the script is only needed by
 * someone who has reached checkout and pressed pay, so every other page avoids
 * a third-party request.
 */

const CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";

/**
 * Which Paddle account this token belongs to.
 *
 * Paddle prefixes client-side tokens: `test_` for sandbox, `live_` for
 * production. The environment is read from the prefix rather than passed
 * separately, so the token and the environment can never disagree with each
 * other here — and the server refuses checkout outright when the token's
 * environment disagrees with `PADDLE_ENV` (see lib/payments/config.ts).
 *
 * There is deliberately no `Paddle.Environment.set(...)` call anywhere: that is
 * the legacy Paddle Classic API. `initializePaddle` takes the environment as a
 * parameter, so there is no global sandbox switch that could be left on.
 */
export const isPaddleSandboxToken = CLIENT_TOKEN.startsWith("test_");

/** Production unless the token explicitly says sandbox. */
const paddleEnvironment: "sandbox" | "production" = isPaddleSandboxToken
  ? "sandbox"
  : "production";

export const hasPaddleClientToken = CLIENT_TOKEN.length > 0;

let cached: Promise<Paddle | undefined> | null = null;

export function loadPaddle(): Promise<Paddle | undefined> {
  if (!CLIENT_TOKEN) return Promise.resolve(undefined);

  cached ??= initializePaddle({
    token: CLIENT_TOKEN,
    environment: paddleEnvironment,
  }).catch((error) => {
    // Reset so a later attempt can retry a transient script failure rather
    // than being stuck with a rejected promise for the life of the page.
    cached = null;
    console.error("[paddle.js] failed to initialise", error);
    return undefined;
  });

  return cached;
}
