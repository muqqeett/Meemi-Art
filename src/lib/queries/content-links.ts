import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * The bridge between what a page teaches and what the shop sells.
 *
 * Products are already tagged with technique slugs by Project Difficulty
 * (`ProductDifficulty.techniques`). A learning page declares the same slugs,
 * and the match is made here — so a page about the magic ring finds the
 * patterns that actually use one, and nobody maintains a list of links by
 * hand. Adding a pattern that uses a technique connects it to that content the
 * moment it is saved.
 *
 * Only published products with an enabled difficulty profile can be returned,
 * and never more than a handful: these are a reading aid, not a shelf.
 */

export type LinkedProduct = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  imageUrl: string | null;
  techniques: string[];
};

export async function productsForTechniques(techniques: readonly string[], take = 3): Promise<LinkedProduct[]> {
  if (techniques.length === 0) return [];

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      difficulty: { enabled: true, techniques: { hasSome: [...techniques] } },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      priceCents: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      difficulty: { select: { techniques: true } },
    },
    orderBy: [{ featured: "desc" }, { ratingAvg: "desc" }, { createdAt: "desc" }],
    take,
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    priceCents: product.priceCents,
    imageUrl: product.images[0]?.url ?? null,
    techniques: product.difficulty?.techniques ?? [],
  }));
}

export type LinkedContent = {
  kind: "article" | "tutorial";
  slug: string;
  title: string;
  excerpt: string;
};

/**
 * The reverse of `productsForTechniques`: what a shopper can read about the
 * techniques a pattern uses.
 *
 * Same matching rule, same vocabulary, pointed the other way — so a product
 * page can offer the article that explains a stitch and the tutorial that walks
 * through it, without anyone maintaining a list by hand.
 *
 * Published only, and filtered by the same clause the public pages use, so a
 * draft can never be surfaced on a product page.
 */
export async function contentForTechniques(
  techniques: readonly string[],
  take = 4,
  now: Date = new Date(),
): Promise<LinkedContent[]> {
  if (techniques.length === 0) return [];

  const where = {
    status: "PUBLISHED" as const,
    publishedAt: { not: null, lte: now },
    teaches: { hasSome: [...techniques] },
  };
  const select = { slug: true, title: true, excerpt: true } as const;
  const order = [{ publishedAt: "desc" as const }];

  const [tutorials, articles] = await Promise.all([
    prisma.tutorial.findMany({ where, select, orderBy: order, take }),
    prisma.article.findMany({ where, select, orderBy: order, take }),
  ]);

  // Tutorials first: on a product page the reader is about to make something,
  // and the step-by-step piece is the more useful of the two.
  return [
    ...tutorials.map((row) => ({ kind: "tutorial" as const, ...row })),
    ...articles.map((row) => ({ kind: "article" as const, ...row })),
  ].slice(0, take);
}

/**
 * A few published patterns to show where nothing more specific applies.
 *
 * Used by pages whose subject is general — hook sizes, yarn weights — so the
 * reader still has somewhere to go, without pretending the match is targeted.
 */
export async function featuredProducts(take = 3): Promise<LinkedProduct[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      priceCents: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      difficulty: { select: { techniques: true } },
    },
    orderBy: [{ featured: "desc" }, { ratingAvg: "desc" }, { createdAt: "desc" }],
    take,
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    priceCents: product.priceCents,
    imageUrl: product.images[0]?.url ?? null,
    techniques: product.difficulty?.techniques ?? [],
  }));
}
