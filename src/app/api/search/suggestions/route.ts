import { NextResponse } from "next/server";
import { z } from "zod";

import { searchSuggestions } from "@/lib/queries/products";

const querySchema = z.object({
  q: z.string().trim().min(1).max(100),
});

/**
 * Typeahead endpoint for the header search dialog.
 *
 * Read-only over the public catalogue, so there is no auth requirement — but
 * the query is still validated and length-capped before it reaches the ORM.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ q: searchParams.get("q") ?? "" });

  if (!parsed.success) {
    return NextResponse.json({ products: [], categories: [] });
  }

  try {
    const results = await searchSuggestions(parsed.data.q);
    return NextResponse.json(results, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (error) {
    console.error("[search/suggestions]", error);
    return NextResponse.json(
      { products: [], categories: [] },
      { status: 500 },
    );
  }
}
