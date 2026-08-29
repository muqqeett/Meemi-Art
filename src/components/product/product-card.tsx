import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { discountPercent, formatMoney } from "@/lib/money";
import { WishlistButton } from "@/components/product/wishlist-button";
import { QuickAddButton } from "@/components/product/quick-add-button";
import type { ProductCardData } from "@/lib/queries/products";

const BADGE_LABELS = {
  new: "New in",
  limited: "Last few",
  custom: "Made to order",
} as const;

/**
 * Badges are set in the type, not in colour. Only scarcity earns a filled
 * label; the rest sit on white so a grid does not turn into bunting.
 */
const BADGE_STYLES = {
  new: "bg-surface text-brand-700",
  limited: "bg-brand-700 text-white",
  custom: "bg-surface text-brand-700",
} as const;

type ProductCardProps = {
  product: ProductCardData;
  className?: string;
  /** Priority-load the image for cards above the fold. */
  priority?: boolean;
  sizes?: string;
};

/**
 * The catalogue card.
 *
 * Editorial proportions: a tall 4:5 image doing almost all of the work, with
 * the type set quietly beneath it. The second gallery shot cross-fades in on
 * hover, and quick-add slides up over the image — neither is available to
 * touch users, who get a persistent add control instead.
 *
 * The whole card is one link with the interactive controls layered above it,
 * so keyboard users get a single stop for the product plus explicit stops for
 * "save" and "add".
 */
export function ProductCard({
  product,
  className,
  priority = false,
  sizes = "(min-width: 1280px) 320px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 47vw",
}: ProductCardProps) {
  const off = discountPercent(product.priceCents, product.compareAtCents);

  return (
    <article className={cn("group/card relative flex flex-col", className)}>
      {/* The 4:5 frame is kept — it sets the grid's rhythm and every other card
          on the page — but the artwork is contained inside it rather than
          filling it. These are crochet patterns: the cover is the product, and
          `object-cover` was trimming 20% of the height off a square file. The
          tinted panel is the frame the leftover space reads as. */}
      <div className="relative aspect-[4/5] overflow-hidden bg-surface-alt">
        {product.imageUrl ? (
          <>
            {/* Hover motion is CSS, not Framer: a transition this simple does
                not justify pulling every card into the client bundle. The
                scale is shared by both frames so the crossfade does not also
                read as a size change. */}
            <Image
              src={product.imageUrl}
              alt={product.imageAlt}
              fill
              sizes={sizes}
              priority={priority}
              className={cn(
                "object-contain transition-[opacity,transform] duration-500 ease-out",
                "group-hover/card:scale-[1.03]",
                product.hoverImageUrl && "group-hover/card:opacity-0",
              )}
            />
            {product.hoverImageUrl && (
              <Image
                src={product.hoverImageUrl}
                alt=""
                aria-hidden
                fill
                sizes={sizes}
                className="object-contain opacity-0 transition-[opacity,transform] duration-500 ease-out group-hover/card:scale-[1.03] group-hover/card:opacity-100"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-xs tracking-wide text-muted-foreground uppercase">
            Image coming soon
          </div>
        )}

        {/* One badge, never a stack. A card wearing three labels is a card
            nobody reads, and the discount is the only one that changes the
            price so it always wins the slot. */}
        {off !== null ? (
          <span className="label-caps pointer-events-none absolute top-3 left-3 bg-royal-600 px-2 py-1 text-white">
            −{off}%
          </span>
        ) : (
          product.badge && (
            <span
              className={cn(
                "label-caps pointer-events-none absolute top-3 left-3 px-2 py-1",
                BADGE_STYLES[product.badge],
              )}
            >
              {BADGE_LABELS[product.badge]}
            </span>
          )
        )}

        <WishlistButton
          productId={product.id}
          productName={product.name}
          initialSaved={product.isWishlisted}
          className="absolute top-3 right-3 z-10 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 focus-visible:opacity-100 max-lg:opacity-100"
        />

        {/* Quick add rides over the image on pointer devices; on touch it is
            always present, since there is no hover to reveal it. There is no
            sold-out state — a file cannot run out. */}
        {product.isAvailable && (
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 z-10 p-2",
              "translate-y-full opacity-0 transition-all duration-250 ease-out",
              "group-hover/card:translate-y-0 group-hover/card:opacity-100",
              "focus-within:translate-y-0 focus-within:opacity-100",
              "max-lg:translate-y-0 max-lg:opacity-100",
            )}
          >
            <QuickAddButton productId={product.id} productName={product.name} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 pt-4">
        {/* Category above the name: it orients the shopper in a mixed grid
            without competing with the product itself. */}
        <p className="text-[0.6875rem] tracking-[0.08em] text-muted-foreground uppercase">
          {product.categoryName}
        </p>

        <h3 className="product-title">
          <Link
            href={`/products/${product.slug}`}
            className="transition-colors after:absolute after:inset-0 after:content-[''] group-hover/card:text-brand-600 focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>

        <p className="mt-auto flex items-baseline gap-2 pt-1">
          <span className="price text-[0.9375rem]">{formatMoney(product.priceCents)}</span>
          {product.compareAtCents && off !== null && (
            <>
              <span className="price-was">{formatMoney(product.compareAtCents)}</span>
              <span className="sr-only">
                , reduced from {formatMoney(product.compareAtCents)}
              </span>
            </>
          )}
        </p>
      </div>
    </article>
  );
}
