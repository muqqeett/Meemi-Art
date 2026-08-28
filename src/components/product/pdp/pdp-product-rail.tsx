import Link from "next/link";

import { PdpProductCard } from "@/components/product/pdp/pdp-product-card";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { staggerStep } from "@/lib/motion";
import type { ProductCardData } from "@/lib/queries/products";

/**
 * "Related Product" / "Popular this week" — Figma 57:1441 and 57:1805.
 *
 *   heading  Clash Grotesk Semibold 28/1.2, #141414, with "View All" on the right
 *   row      five 212-wide cards across the 1200 column
 *
 * Renders nothing at all when there is nothing to show. An empty rail under a
 * heading reads as a page that failed to load, and this catalogue is new — the
 * product page should look finished with one product in it, not broken.
 */
export function PdpProductRail({
  title,
  href,
  products,
  soldCounts,
}: {
  title: string;
  href: string;
  products: ProductCardData[];
  soldCounts: Map<string, number>;
}) {
  if (products.length === 0) return null;

  return (
    <section className="w-full">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-clash text-2xl leading-[1.2] font-semibold text-pdp-price sm:text-[1.75rem]">
          {title}
        </h2>
        <Link
          href={href}
          className="font-clash text-base leading-[1.2] font-medium text-pdp-meta underline underline-offset-2 hover:text-pdp-price"
        >
          View All
        </Link>
      </div>

      <RevealGroup
        step={staggerStep.small}
        as="ul"
        className="mt-6 grid grid-cols-2 gap-x-[22px] gap-y-8 sm:grid-cols-3 lg:grid-cols-5"
      >
        {products.map((product) => (
          <RevealItem as="li" key={product.id}>
            <PdpProductCard
              product={product}
              soldCount={soldCounts.get(product.id) ?? 0}
            />
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
