import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { discountPercent, formatMoney } from "@/lib/money";
import { WishlistButton } from "@/components/product/wishlist-button";
import { QuickAddButton } from "@/components/product/quick-add-button";
import type { ProductCardData } from "@/lib/queries/products";

type PlumProductCardProps = {
  product: ProductCardData;
  className?: string;
  /** Priority-load the image for cards above the fold. */
  priority?: boolean;
  sizes?: string;
};

/**
 * Catalogue card — Figma "Product card" (12:145).
 *
 * White card, 1px line, 20px radius, 8px padding. A square media well in the
 * plum tint with the artwork contained inside it (these are crochet-pattern
 * covers, so they are shown whole, not cropped), the save heart top right and
 * one flag top left. Beneath: a caption line, a two-line title, the rating,
 * and a footer with the price and the marigold Add button.
 *
 * Everything shown is real. The design's flags are "Bestseller" and "New";
 * there is no sales ranking to back the first (see `badge` on
 * `ProductCardData`), so the only flags are "New" and a discount percentage.
 * The rating row is drawn only when the product has reviews: "0.0 (0)" would
 * state something the shop cannot support.
 *
 * The whole card is one link with the save and add controls layered above it,
 * so keyboard users get a single stop for the product plus explicit stops for
 * "save" and "add".
 */
export function PlumProductCard({
  product,
  className,
  priority = false,
  sizes = "(min-width: 1024px) 288px, (min-width: 640px) 45vw, 47vw",
}: PlumProductCardProps) {
  const off = discountPercent(product.priceCents, product.compareAtCents);
  const hasRating = product.reviewCount > 0;

  return (
    <article
      className={cn(
        "group/card font-figtree relative flex flex-col rounded-[20px] border border-pl-line bg-pl-surface p-2 shadow-pl-sm transition-shadow hover:shadow-pl-md",
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden rounded-[12px] bg-pl-tint-crochet">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt}
            fill
            sizes={sizes}
            priority={priority}
            className="object-contain p-[8%] transition-transform duration-300 ease-out group-hover/card:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] font-medium text-pl-muted">
            Image coming soon
          </div>
        )}

        {off !== null ? (
          <span className="pointer-events-none absolute top-2.5 left-2.5 rounded-full bg-plum-900 px-2.5 py-1 text-[13px] leading-4 font-bold tracking-[0.01em] text-pl-on-dark">
            −{off}%
          </span>
        ) : (
          product.badge && (
            <span className="pointer-events-none absolute top-2.5 left-2.5 rounded-full bg-plum-500 px-2.5 py-1 text-[13px] leading-4 font-bold tracking-[0.01em] text-pl-on-dark">
              New
            </span>
          )
        )}

        <WishlistButton
          productId={product.id}
          productName={product.name}
          initialSaved={product.isWishlisted}
          variant="plum"
          className="absolute top-2.5 right-2 z-10"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1 px-2 pt-3 pb-1.5">
        <p className="text-[13px] leading-[18px] font-medium text-pl-muted">
          {product.categoryName}
        </p>

        <h3 className="min-h-11 text-base leading-[22px] font-bold tracking-[-0.005em] text-pl-text">
          <Link
            href={`/products/${product.slug}`}
            className="line-clamp-2 after:absolute after:inset-0 after:rounded-[20px] after:content-[''] focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>

        {hasRating && (
          <p className="flex items-center gap-1 text-[13px] leading-[18px] font-medium text-pl-muted">
            <Star className="size-3.5 text-plum-500" aria-hidden />
            <span>
              {product.ratingAvg.toFixed(1)} ({product.reviewCount})
            </span>
            <span className="sr-only">
              average rating from {product.reviewCount}{" "}
              {product.reviewCount === 1 ? "review" : "reviews"}
            </span>
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <p className="flex items-baseline gap-2">
            <span className="pl-display pl-price">{formatMoney(product.priceCents)}</span>
            {product.compareAtCents && off !== null && (
              <>
                <span className="text-[13px] leading-[18px] font-medium text-pl-muted line-through">
                  {formatMoney(product.compareAtCents)}
                </span>
                <span className="sr-only">
                  , reduced from {formatMoney(product.compareAtCents)}
                </span>
              </>
            )}
          </p>

          {product.isAvailable && (
            <div className="relative z-10">
              <QuickAddButton
                productId={product.id}
                productName={product.name}
                variant="plum"
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
