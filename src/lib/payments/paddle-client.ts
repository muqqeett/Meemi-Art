"use client";

import {
  initializePaddle,
  type Paddle,
  type PaddleEventData,
} from "@paddle/paddle-js";

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
 * the sandbox or the reverse. There is deliberately no
 * `Paddle.Environment.set(...)` call anywhere — that is the legacy Paddle
 * Classic API, and `initializePaddle` takes the environment as a parameter, so
 * there is no global switch that could be left on sandbox.
 *
 * Loaded lazily rather than in the root layout — the script is only needed by
 * someone who has reached checkout and pressed pay, so every other page avoids
 * a third-party request.
 */

const CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";

/** Sandbox tokens are prefixed by Paddle. */
export const isPaddleSandboxToken = CLIENT_TOKEN.startsWith("test_");

const paddleEnvironment: "sandbox" | "production" = isPaddleSandboxToken
  ? "sandbox"
  : "production";

export const hasPaddleClientToken = CLIENT_TOKEN.length > 0;

/**
 * Checkout events are delivered to one callback registered at init, but the
 * component that cares is mounted long afterwards. Paddle is initialised once
 * per page and events are fanned out to whoever is currently listening.
 */
type Listener = (event: PaddleEventData) => void;
const listeners = new Set<Listener>();

export function onPaddleEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let cached: Promise<Paddle | undefined> | null = null;

export function loadPaddle(): Promise<Paddle | undefined> {
  if (!CLIENT_TOKEN) return Promise.resolve(undefined);

  cached ??= initializePaddle({
    token: CLIENT_TOKEN,
    environment: paddleEnvironment,
    eventCallback: (event) => {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          // One listener throwing must not stop the others, and must never
          // take down the payment flow.
          console.error("[paddle.js] listener failed", error);
        }
      }
    },
  }).catch((error) => {
    // Reset so a later attempt can retry a transient script failure rather
    // than being stuck with a rejected promise for the life of the page.
    cached = null;
    console.error("[paddle.js] failed to initialise", error);
    return undefined;
  });

  return cached;
}

/**
 * The DOM class Paddle renders its inline checkout into.
 *
 * Paddle looks this up itself and injects an iframe. The element must exist
 * and be visible before `open` is called, or Paddle has nowhere to mount.
 */
export const PADDLE_FRAME_CLASS = "paddle-checkout-frame";
