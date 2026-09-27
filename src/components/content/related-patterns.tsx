import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { LinkedProduct } from "@/lib/queries/content-links";
import { formatMoney } from "@/lib/money";

/**
 * Patterns that use what this page just explained.
 *
 * Shown only when there is a real match: the products come from the technique
 * tags a page and a pattern share, so an empty result renders nothing rather
 * than a row of whatever happened to be in stock. A learning page that has
 * nothing relevant to sell is allowed to simply teach.
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
    <section aria-labelledby="related-patterns" className="border-t border-border pt-10">
      <h2 id="related-patterns" className="heading-sub">
        {heading}
      </h2>
      {blurb && <p className="text-body mt-3 max-w-2xl leading-relaxed">{blurb}</p>}

      <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <li key={product.id}>
            <Link
              href={`/products/${product.slug}`}
              className="group block h-full overflow-hidden rounded-sm border border-border bg-card transition-colors duration-200 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <span className="relative block aspect-[4/3] overflow-hidden bg-surface-alt">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 20rem, (min-width: 640px) 45vw, 90vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : null}
              </span>
              <span className="block px-4 py-3.5">
                <span className="block text-sm font-medium text-foreground group-hover:text-brand-700">
                  {product.name}
                </span>
                <span className="text-body mt-1 flex items-center gap-1.5 text-xs">
                  {formatMoney(product.priceCents)} · digital pattern
                  <ArrowRight
                    className="size-3 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
