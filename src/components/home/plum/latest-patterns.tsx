import Link from "next/link";

import { PlumProductCard } from "@/components/product/plum-product-card";
import type { ProductCardData } from "@/lib/queries/products";

/**
 * Product rail — Figma "Bestsellers" (17:481): a heading with a "View all →"
 * link, then four of the catalogue's cards.
 *
 * The design says "Bestsellers this month". The shop has no sales ranking worth
 * printing as a claim (`getBestSellers` falls back to ratings when nothing has
 * sold, and counts unpaid orders), so this is "New patterns": the newest
 * products, which is simply true. The cards are the same ones the shop uses,
 * with their real photographs, prices, save hearts and Add buttons.
 */
export function LatestPatterns({ products }: { products: ProductCardData[] }) {
  if (products.length === 0) return null;

  return (
    <section
      aria-labelledby="home-latest"
      className="font-figtree mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 lg:py-14"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="home-latest" className="pl-display pl-h2">
          New patterns
        </h2>
        <Link
          href="/shop"
          className="pl-focus rounded-sm text-sm leading-[22px] font-bold whitespace-nowrap text-plum-500 underline-offset-4 hover:underline"
        >
          View all →
        </Link>
      </div>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
        {products.slice(0, 4).map((product, index) => (
          <li key={product.id} className="flex">
            <PlumProductCard
              product={product}
              priority={index < 2}
              className="w-full"
              sizes="(min-width: 1024px) 286px, 47vw"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
