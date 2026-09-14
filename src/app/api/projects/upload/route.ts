import { NextResponse } from "next/server";

import {
  createProjectForSession,
  isSameOriginRequest,
  signProjectUploadForSession,
  type ProjectFailureCode,
} from "@/lib/projects/mutations";

/**
 * Customer project photo upload — the two server halves of a direct browser
 * upload, as for product video.
 *
 *   step "sign"      returns parameters signed for one upload into this
 *                    customer's own prefix in the customer-projects folder
 *   step "finalize"  verifies what storage actually holds and records it as a
 *                    PENDING project
 *
 * The photo itself never passes through this function. Every rule — session,
 * purchase, cap, rate limit, key ownership, verification — lives in
 * `lib/projects/mutations.ts`; this handler only checks the origin, bounds the
 * body and translates results into responses. It reads no user id from the
 * request: there is nowhere to put one.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A product id, a key, a caption and a display name, with room to spare. */
const MAX_BODY_BYTES = 4_000;

const STATUS: Record<ProjectFailureCode, number> = {
  sign_in: 401,
  invalid: 400,
  unavailable: 404,
  not_purchased: 403,
  limit: 409,
  rate_limited: 429,
  conflict: 409,
  not_found: 404,
  storage: 503,
  failed: 500,
};

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request.headers.get("origin"), request.headers.get("host"))) {
    return reply({ error: "Not allowed." }, 403);
  }

  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return reply({ error: "That request is too large." }, 413);
  }
  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) {
    return reply({ error: "That request is too large." }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reply({ error: "Please try again." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return reply({ error: "Please try again." }, 400);
  }

  const { step, ...payload } = body as Record<string, unknown>;
  const result =
    step === "sign"
      ? await signProjectUploadForSession(payload)
      : step === "finalize"
        ? await createProjectForSession(payload)
        : null;

  if (!result) return reply({ error: "Unknown request." }, 400);
  if (!result.ok) {
    return reply(
      { error: result.error, ...(result.requiresSignIn ? { requiresSignIn: true } : {}) },
      STATUS[result.code],
    );
  }
  return reply(result.data);
}
