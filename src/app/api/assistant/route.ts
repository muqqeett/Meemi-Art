import { NextResponse } from "next/server";

import { isAssistantConfigured } from "@/lib/ai/client";
import { createAnthropicLlm } from "@/lib/ai/assistant-llm";
import { parseAssistantRequest } from "@/lib/assistant/request";
import { FALLBACK_HREF, runAssistantSafely } from "@/lib/assistant/run";
import { allowAssistantRequest } from "@/lib/assistant/throttle";
import type { AssistantReply } from "@/lib/assistant/types";

/**
 * The crochet assistant's single endpoint.
 *
 * Public: product discovery needs no account, and nothing here reads one. The
 * route never looks at the session, so a signed-in customer's data cannot
 * reach the model or the reply.
 *
 * Order matters: configuration, origin and size checks cost nothing; the rate
 * limit is counted before any model or database work is done.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generous for twelve short turns of text; anything larger is not a chat. */
const MAX_BODY_BYTES = 32_000;

function reply(body: AssistantReply, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function unavailable(error: string, status: number, extra: Partial<AssistantReply> = {}) {
  return reply({ ok: false, error, fallbackHref: FALLBACK_HREF, ...extra } as AssistantReply, status);
}

/** The caller's address as the platform reports it; one shared bucket if unknown. */
function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

/**
 * Same-origin only. A cross-site page cannot send a JSON POST here without a
 * preflight this route never answers, but checking `Origin` as well means
 * another site cannot spend the store's AI budget through a visitor's browser.
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isAssistantConfigured()) {
    return unavailable("The pattern assistant isn't available right now.", 503);
  }

  if (!isSameOrigin(request)) {
    return unavailable("Not allowed.", 403);
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return unavailable("That message is too long.", 413);
  }

  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) {
    return unavailable("That message is too long.", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return unavailable("Please try sending that again.", 400);
  }

  const parsed = parseAssistantRequest(body);
  if (!parsed) {
    return unavailable("Please try sending that again.", 400);
  }

  const verdict = await allowAssistantRequest(clientAddress(request));
  if (!verdict.allowed) {
    return reply(
      {
        ok: false,
        error: "You've sent a lot of messages in a short time. Please wait a few minutes and try again.",
        fallbackHref: FALLBACK_HREF,
        retryAfterSeconds: verdict.retryAfterSeconds,
      },
      429,
      { "Retry-After": String(verdict.retryAfterSeconds) },
    );
  }

  const result = await runAssistantSafely(parsed, createAnthropicLlm());
  return reply(result, result.ok ? 200 : 502);
}
