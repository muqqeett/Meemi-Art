import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { discountPercent, formatMoney } from "@/lib/money";
import type { AssistantRecommendation } from "@/lib/assistant/types";

/**
 * A recommendation inside the assistant panel.
 *
 * A compact, horizontal cousin of `ProductCard` rather than the card itself:
 * the catalogue card is a tall 4:5 frame with hover crossfades, wishlist and
 * quick add, sized for a grid, and it does not fit a 400px chat column. This
 * keeps the parts that carry meaning — contained cover image, name, category,
 * the same money formatting and discount rule — and links to the existing
 * product page.
 *
 * Everything shown is server data. The model contributes only `reason`.
 */
export function AssistantProductCard({
  recommendation,
  onNavigate,
}: {
  recommendation: AssistantRecommendation;
  onNavigate?: () => void;
}) {
  const { product, reason } = recommendation;
  const off = discountPercent(product.priceCents, product.compareAtCents);
  const href = `/products/${product.slug}`;

  return (
    <article className="group/rec relative flex gap-3 rounded-sm border border-border bg-surface p-2.5 transition-colors hover:border-brand-700/30">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xs bg-surface-alt">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt}
            fill
            sizes="80px"
            className="object-contain"
          />
        ) : (
          <span className="flex h-full items-center justify-center px-1 text-center text-[0.625rem] text-muted-foreground">
            No image
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-[0.6875rem] tracking-[0.08em] text-muted-foreground uppercase">
          {product.categoryName}
        </p>
        <h3 className="mt-0.5 line-clamp-2 text-sm leading-snug font-semibold text-foreground">
          {/* The whole card is the link target; the stretched pseudo-element
              keeps one tab stop per product. */}
          <Link
            href={href}
            onClick={onNavigate}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>

        <p className="mt-1 flex items-baseline gap-2">
          <span className="price text-sm">{formatMoney(product.priceCents)}</span>
          {product.compareAtCents && off !== null && (
            <>
              <span className="price-was text-xs">{formatMoney(product.compareAtCents)}</span>
              <span className="sr-only">, reduced from {formatMoney(product.compareAtCents)}</span>
            </>
          )}
          <span className="text-[0.6875rem] text-muted-foreground">Digital pattern</span>
        </p>

        {reason && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{reason}</p>}

        <span
          aria-hidden
          className="label-caps mt-2 inline-flex items-center gap-1 text-brand-700 transition-colors group-hover/rec:text-royal-600"
        >
          View pattern
          <ArrowRight className="size-3" />
        </span>
      </div>

      {/* Keyboard focus ring drawn on the card, since the link itself is the
          invisible stretched layer. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-sm ring-royal-600 group-has-[a:focus-visible]/rec:ring-2"
      />
    </article>
  );
}
