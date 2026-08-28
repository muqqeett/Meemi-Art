"use client";

import { useState, useTransition } from "react";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";

import { addToCart } from "@/lib/actions/cart";
import { useCartUI } from "@/lib/stores/cart-ui";
import { cn } from "@/lib/utils";

type QuickAddButtonProps = {
  productId: string;
  productName: string;
  className?: string;
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
        "label-caps flex h-11 w-full items-center justify-center gap-2 rounded-xs",
        "bg-surface/95 text-brand-700 backdrop-blur-sm transition-colors",
        "hover:bg-brand-700 hover:text-white",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600",
        "disabled:pointer-events-none disabled:opacity-70",
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
      ) : (
        label
      )}
    </button>
  );
}
