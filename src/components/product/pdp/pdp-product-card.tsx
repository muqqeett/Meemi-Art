import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

import { formatMoney } from "@/lib/money";
import type { ProductCardData } from "@/lib/queries/products";

/**
 * The rail card — Figma 57:1448.
 *
 *   card    212 wide, 16 between image and text
 *   image   212 × 284 on #F2F2F2, 8px radius
 *   brand   Clash Grotesk Semibold 18/1.4, #292929, -0.2 tracking
 *   price   Clash Grotesk Semibold 20/1.4, #141414
 *   desc    Clash Grotesk Regular 16/1.2, #7A7A7A, two lines
 *   rating  star · value · dot · "N Sold", 16/1.6
 *
 * Brand above price above description is the design's order, and it is a
 * retailer's order — the shopper is scanning for a label. The product's own
 * name does the work of the design's description line, since that is the field
 * this catalogue actually has.
 */
export function PdpProductCard({
  product,
  soldCount,
}: {
  product: ProductCardData;
  soldCount: number;
}) {
  return (
    <article className="group/card flex flex-col gap-4">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[212/284] w-full overflow-hidden rounded-[3px] bg-pdp-field ring-1 ring-pdp-hairline transition-[box-shadow] duration-200 group-hover/card:ring-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pdp-price"
        tabIndex={-1}
        aria-hidden={product.imageUrl ? undefined : true}
      >
        {product.imageUrl && (
          <Image
            src={product.imageUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 212px, 45vw"
            /* Contained, not cropped: the Figma frame is 212×284, which was
               cutting a quarter of the height off a square cover. */
            className="object-contain transition-transform duration-200 ease-out group-hover/card:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover/card:scale-100"
          />
        )}
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-col gap-1.5">
            <p className="font-clash text-lg leading-[1.4] font-semibold tracking-[-0.2px] text-pdp-title">
              {product.brand}
            </p>
            <p className="font-clash text-xl leading-[1.4] font-semibold tracking-[-0.2px] text-pdp-price">
              {formatMoney(product.priceCents)}
            </p>
          </div>

          <h3 className="font-clash text-base leading-[1.2] text-pdp-subtle">
            <Link
              href={`/products/${product.slug}`}
              className="transition-colors group-hover/card:text-pdp-price focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pdp-price"
            >
              {product.name}
            </Link>
          </h3>
        </div>

        {(product.reviewCount > 0 || soldCount > 0) && (
          <div className="flex items-center gap-2">
            {product.reviewCount > 0 && (
              <>
                <Star className="size-6 shrink-0 fill-pdp-star text-pdp-star" aria-hidden />
                <span className="font-clash text-base leading-[1.6] text-pdp-ink">
                  {product.ratingAvg.toFixed(1)}
                </span>
              </>
            )}

            {product.reviewCount > 0 && soldCount > 0 && (
              <span aria-hidden className="size-1 rounded-full bg-pdp-border" />
            )}

            {soldCount > 0 && (
              <span className="font-clash text-base leading-[1.6] text-pdp-body">
                {soldCount.toLocaleString("en-US")} Sold
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
