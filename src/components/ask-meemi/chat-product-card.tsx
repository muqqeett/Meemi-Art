"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";

import { addToCartBySlug } from "@/lib/actions/cart";
import { formatMoney } from "@/lib/money";
import { useCartUI } from "@/lib/stores/cart-ui";
import type { AssistantProduct } from "@/lib/assistant/types";
import { cn } from "@/lib/utils";

/**
 * A result inside Ask Meemi — Figma "Chat product card" (186:4067).
 *
 * 168px wide: a 140px photo, "Beginner · Amigurumi", the name, the price with a
 * marigold Add (the buy colour, used only for buying), and "See pattern →".
 * The whole card is the link; Add sits above it so it can be pressed on its own.
 *
 * Everything shown is catalogue data the server attached to the reply. Add goes
 * through the shop's own add-to-cart rules by slug, updates the bag count, and
 * tells Meemi so she can look happy — it does not pop the bag open over the chat.
 */
export function ChatProductCard({
  product,
  onNavigate,
  onAdded,
  className,
}: {
  product: AssistantProduct;
  onNavigate?: () => void;
  onAdded?: () => void;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const setCount = useCartUI((state) => state.setCount);

  const meta = [product.difficulty?.levelLabel, product.categoryName].filter(Boolean).join(" · ");

  function add() {
    setProblem(null);
    startTransition(async () => {
      const result = await addToCartBySlug({ slug: product.slug });
      if (!result.ok) {
        setProblem(result.error);
        return;
      }
      setCount(result.data.itemCount);
      setAdded(true);
      onAdded?.();
      window.setTimeout(() => setAdded(false), 2400);
    });
  }

  return (
    <article
      className={cn(
        "font-figtree group/card relative flex w-[168px] shrink-0 flex-col overflow-hidden rounded-[14px] border border-pl-line bg-pl-surface",
        className,
      )}
    >
      <div className="relative h-[140px] w-full bg-pl-tint-crochet">
        {product.imageUrl && (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt}
            fill
            sizes="168px"
            className="object-cover"
          />
        )}
      </div>

      <div className="flex flex-col gap-1 px-2.5 pt-2 pb-2.5">
        <p className="truncate text-[11px] leading-[normal] text-pl-muted">{meta}</p>
        <h3 className="line-clamp-2 text-[13px] leading-[normal] font-bold text-pl-text">
          {/* The stretched link makes the whole card one tab stop. */}
          <Link
            href={`/products/${product.slug}`}
            onClick={onNavigate}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {product.name}
          </Link>
        </h3>

        <div className="flex items-center justify-between gap-2">
          <p className="text-sm leading-[normal] font-bold text-pl-text">{formatMoney(product.priceCents)}</p>
          <button
            type="button"
            onClick={add}
            disabled={pending}
            aria-label={`Add ${product.name} to bag`}
            className="pl-focus relative z-10 inline-flex min-h-6 items-center gap-1 rounded-full bg-pl-buy px-2.5 py-1 text-xs leading-[normal] font-bold text-pl-text transition-[filter] hover:brightness-95 disabled:opacity-70"
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : added ? (
              <Check className="size-3" aria-hidden />
            ) : null}
            {added ? "Added" : "Add"}
          </button>
        </div>

        {problem ? (
          <p role="alert" className="text-[11px] leading-snug text-destructive">
            {problem}
          </p>
        ) : (
          <p aria-hidden className="text-xs leading-[normal] font-bold text-plum-500">
            See pattern →
          </p>
        )}
      </div>

      {/* The card's focus ring, since the link itself is the invisible layer. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[14px] ring-plum-500 group-has-[a:focus-visible]/card:ring-[3px]"
      />
    </article>
  );
}
