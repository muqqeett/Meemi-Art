import "server-only";

import { paymentConfig } from "@/lib/payments/config";

/**
 * Authenticated calls to Paddle's REST API.
 *
 * One place owns the base URL and the Authorization header, so no other module
 * ever handles `PADDLE_API_KEY`. The base comes from `paymentConfig`, which
 * resolves to `sandbox-api.paddle.com` for anything other than an explicit
 * `PADDLE_ENV=production` — a missing or misspelt value can only ever point at
 * test money.
 *
 * Errors are deliberately lossy toward the caller. Paddle's error body
 * describes the request and can echo values from it, so it is logged but never
 * returned to a customer; call sites get a status and a short code.
 */

export class PaddleApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PaddleApiError";
  }
}

type PaddleResponse<T> = { data?: T; error?: { code?: string; detail?: string } };

/** Paddle's own request timeout. A hung checkout is worse than a failed one. */
const TIMEOUT_MS = 15_000;

async function request<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<T> {
  if (!paymentConfig.paddle.apiKey) {
    throw new PaddleApiError(0, "not_configured", "PADDLE_API_KEY is not set.");
  }

  const url = `${paymentConfig.paddle.apiBase}${path.startsWith("/") ? path : `/${path}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${paymentConfig.paddle.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (cause) {
    throw new PaddleApiError(0, "network", `Could not reach Paddle: ${String(cause)}`);
  }

  const text = await response.text();
  let payload: PaddleResponse<T> = {};
  try {
    payload = text ? (JSON.parse(text) as PaddleResponse<T>) : {};
  } catch {
    // Fall through — a non-JSON body from Paddle is itself the error.
  }

  if (!response.ok) {
    const code = payload.error?.code ?? "unknown";
    // Logged server-side only. `detail` can quote the request back, which for a
    // transaction includes prices and the customer's email.
    console.error(
      `[paddle] ${method} ${path} -> HTTP ${response.status} ${code}`,
      payload.error?.detail ?? text.slice(0, 500),
    );
    throw new PaddleApiError(response.status, code, `Paddle returned HTTP ${response.status}.`);
  }

  if (payload.data === undefined) {
    throw new PaddleApiError(response.status, "empty", "Paddle returned no data.");
  }

  return payload.data;
}

export const paddleApi = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),

  /** True when a key is present. Says nothing about whether the key is valid. */
  get isConfigured(): boolean {
    return Boolean(paymentConfig.paddle.apiKey);
  },

  /**
   * Cheapest authenticated call Paddle offers, used to prove the key actually
   * works. Returns the failure rather than throwing so admin settings can
   * render a red light instead of a crash.
   */
  async check(): Promise<{ ok: true } | { ok: false; reason: string }> {
    if (!paddleApi.isConfigured) return { ok: false, reason: "PADDLE_API_KEY is not set." };
    try {
      await request<unknown>("GET", "/event-types");
      return { ok: true };
    } catch (error) {
      if (error instanceof PaddleApiError) {
        return {
          ok: false,
          reason:
            error.status === 403 || error.status === 401
              ? "Paddle rejected the API key. Check it belongs to this environment."
              : `Paddle check failed (${error.code}).`,
        };
      }
      return { ok: false, reason: "Paddle check failed." };
    }
  },
};
