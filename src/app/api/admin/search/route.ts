import { NextResponse } from "next/server";

import { getAdminOrNull } from "@/lib/auth-guards";
import { searchAdmin } from "@/lib/queries/admin-search";

/**
 * Global admin search.
 *
 * Re-checks the admin role on every call rather than trusting that only the
 * admin UI knows the URL — this route reads order and customer records, so it
 * is exactly as sensitive as the pages that render them. A non-admin gets 404,
 * matching `requireAdmin`, so the endpoint's existence is not confirmed.
 */
export async function GET(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return new NextResponse(null, { status: 404 });

  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json(await searchAdmin(q));
}
