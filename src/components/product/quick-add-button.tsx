"use client";

import { useState, useTransition } from "react";
import { Loader2, Check, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { addToCart } from "@/lib/actions/cart";
import { useCartUI } from "@/lib/stores/cart-ui";
import { cn } from "@/lib/utils";

type QuickAddButtonProps = {
  productId: string;
  productName: string;
  className?: string;
  /**
   * `plum` is the Plum Studio card control: marigold pill, plum outline, bag
   * glyph and "Add". Marigold is the buy colour, so it is used here and only
   * for purchase actions.
   */
  variant?: "default" | "plum";
};

/**
 * The add control that rides over a product card image.
 *
 * A digital product has nothing to choose — no size, no colourway — so this
 * always adds straight to the bag rather than routing to the product page to
 * pick something that does not exist.
 */
export function QuickAddButton({
  productId,
  productName,
  className,
  variant = "default",
}: QuickAddButtonProps) {
  const [pending, startTransition] = useTransition();
  const [justAdded, setJustAdded] = useState(false);
  const { setCount, open } = useCartUI();

  const label = "Quick add";

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    startTransition(async () => {
      const result = await addToCart({ productId, quantity: 1 });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setCount(result.data.itemCount);
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 1600);
      open();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={
        `Add ${productName} to bag`
      }
      className={cn(
        variant === "plum"
          ? [
              "pl-focus font-figtree inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-3",
              "border-2 border-plum-900 bg-pl-buy text-[14px] leading-[18px] font-bold text-pl-text transition-colors",
              "hover:brightness-95 disabled:pointer-events-none disabled:opacity-70",
            ]
          : [
              "label-caps flex h-11 w-full items-center justify-center gap-2 rounded-xs",
              "bg-surface/95 text-brand-700 backdrop-blur-sm transition-colors",
              "hover:bg-brand-700 hover:text-white",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600",
              "disabled:pointer-events-none disabled:opacity-70",
            ],
        className,
      )}
    >
      {pending ? (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Adding
        </>
      ) : justAdded ? (
        <>
          <Check className="size-3.5" aria-hidden />
          Added
        </>
      ) : variant === "plum" ? (
        <>
          <ShoppingBag className="size-5" aria-hidden />
          Add
        </>
      ) : (
        label
      )}
    </button>
  );
}
