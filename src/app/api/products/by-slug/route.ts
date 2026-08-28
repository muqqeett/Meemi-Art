import { NextResponse } from "next/server";
import { z } from "zod";

import { getProductsBySlugs } from "@/lib/queries/products";

const schema = z.object({
  slugs: z
    .string()
    .max(500)
    .transform((value) =>
      value
        .split(",")
        .map((slug) => slug.trim())
        .filter(Boolean)
        .slice(0, 8),
    ),
});

/** Hydrates the client-held "recently viewed" slug list into product cards. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({ slugs: searchParams.get("slugs") ?? "" });

  if (!parsed.success || parsed.data.slugs.length === 0) {
    return NextResponse.json([]);
  }

  try {
    const products = await getProductsBySlugs(parsed.data.slugs);
    return NextResponse.json(products, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    console.error("[api/products/by-slug]", error);
    return NextResponse.json([], { status: 500 });
  }
}
