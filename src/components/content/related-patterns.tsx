import Image from "next/image";
import Link from "next/link";

import type { LinkedProduct } from "@/lib/queries/content-links";
import { formatMoney } from "@/lib/money";

/**
 * Patterns that use what this page just explained — Plum Studio "Related
 * pattern" (27:2823) adapted to a row of cards.
 *
 * Shown only when there is a real match: the products come from the technique
 * tags a page and a pattern share, so an empty result renders nothing rather
 * than a row of whatever happened to be in stock. A learning page that has
 * nothing relevant to sell is allowed to simply teach.
 *
 * The cards are the catalogue card's shape (white, 20px radius, square plum
 * well, Bricolage price) without its Add button: `LinkedProduct` carries no
 * availability, and this is an invitation to read about a pattern, not a
 * checkout surface.
 */
export function RelatedPatterns({
  products,
  heading = "Patterns that use this",
  blurb,
}: {
  products: LinkedProduct[];
  heading?: string;
  blurb?: string;
}) {
  if (products.length === 0) return null;

  return (
    <section
      aria-labelledby="related-patterns"
      className="font-figtree rounded-[20px] bg-pl-subtle p-5 sm:p-6"
    >
      <p className="pl-eyebrow">Practise it</p>
      <h2 id="related-patterns" className="pl-h3 mt-2">
        {heading}
      </h2>
      {blurb && <p className="mt-2 max-w-2xl text-sm leading-[22px] text-pl-muted">{blurb}</p>}

      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <li key={product.id}>
            <Link
              href={`/products/${product.slug}`}
              className="pl-focus group flex h-full flex-col rounded-[20px] border border-pl-line bg-pl-surface p-2 shadow-pl-sm transition-shadow hover:shadow-pl-md"
            >
              <span className="relative block aspect-square overflow-hidden rounded-[12px] bg-pl-tint-crochet">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 20rem, (min-width: 640px) 45vw, 90vw"
                    className="object-contain p-[8%] transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : null}
              </span>
              <span className="flex flex-col gap-1 px-2 pt-3 pb-1.5">
                <span className="text-[13px] leading-[18px] font-medium text-pl-muted">
                  Digital pattern
                </span>
                <span className="text-base leading-[22px] font-bold tracking-[-0.005em] text-pl-text">
                  {product.name}
                </span>
                <span className="pl-display pl-price pt-2">{formatMoney(product.priceCents)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
