"use client";

import { useTransition } from "react";
import { Loader2, ShoppingBag, Check } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { addToCart } from "@/lib/actions/cart";
import { useCartUI } from "@/lib/stores/cart-ui";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";
import type { buttonVariants } from "@/components/ui/button";

type AddToCartButtonProps = {
  productId: string;
  quantity?: number;
  disabled?: boolean;
  /** Shown when the product cannot currently be bought. */
  unavailableLabel?: string;
  label?: string;
  className?: string;
  size?: VariantProps<typeof buttonVariants>["size"];
  variant?: VariantProps<typeof buttonVariants>["variant"];
  /** Slide the cart drawer open after a successful add. */
  openDrawerOnSuccess?: boolean;
  showIcon?: boolean;
};

export function AddToCartButton({
  productId,
  quantity = 1,
  disabled = false,
  unavailableLabel = "Unavailable",
  label = "Add to cart",
  className,
  size = "pillSm",
  variant = "brand",
  openDrawerOnSuccess = false,
  showIcon = false,
}: AddToCartButtonProps) {
  const [pending, startTransition] = useTransition();
  const [justAdded, setJustAdded] = useState(false);
  const { setCount, open } = useCartUI();

  const unavailable = disabled;

  function handleClick() {
    startTransition(async () => {
      const result = await addToCart({ productId, quantity });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setCount(result.data.itemCount);
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 1600);

      if (openDrawerOnSuccess) {
        open();
      } else {
        toast.success("Added to your bag");
      }
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      disabled={unavailable || pending}
      onClick={handleClick}
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          <span>Adding…</span>
        </>
      ) : justAdded ? (
        <>
          <Check aria-hidden />
          <span>Added</span>
        </>
      ) : (
        <>
          {showIcon && <ShoppingBag aria-hidden />}
          <span>{unavailable ? unavailableLabel : label}</span>
        </>
      )}
    </Button>
  );
}
