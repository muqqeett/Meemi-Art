"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { toggleWishlist } from "@/lib/actions/wishlist";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";

type WishlistButtonProps = {
  productId: string;
  productName: string;
  initialSaved: boolean;
  /** `floating` overlays the product image; `inline` sits in a row of buttons. */
  variant?: "floating" | "inline";
  className?: string;
};

export function WishlistButton({
  productId,
  productName,
  initialSaved,
  variant = "floating",
  className,
}: WishlistButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useOptimistic(initialSaved);

  function handleClick(event: React.MouseEvent) {
    // The card is wrapped in a link — keep the click local to the button.
    event.preventDefault();
    event.stopPropagation();

    startTransition(async () => {
      setSaved(!saved);
      const result = await toggleWishlist(productId);

      if (!result.ok) {
        toast.error(result.error, {
          action: { label: "Sign in", onClick: () => router.push("/login") },
        });
        return;
      }

      toast.success(
        result.data.added
          ? `${productName} saved to your wishlist`
          : `${productName} removed from your wishlist`,
      );
      router.refresh();
    });
  }

  const label = saved
    ? `Remove ${productName} from wishlist`
    : `Save ${productName} to wishlist`;

  return (
    // A press gives, and the heart settles once when it fills. Deliberately no
    // burst, no rebound, no particles — the brief is restraint, and this
    // control sits on top of product photography.
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.92 }}
      transition={{ duration: duration.fast, ease: ease.standard }}
      className={cn(
        "inline-flex items-center justify-center transition-all",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        variant === "floating"
          ? // 44px on touch screens, the drawn 36px from sm up where a cursor
            // is doing the pointing.
            "size-11 sm:size-9 rounded-full bg-white/90 text-ink shadow-sm backdrop-blur-sm hover:bg-white hover:text-brand-700"
          : "size-11 rounded-full border border-border bg-background text-muted-foreground hover:border-brand-300 hover:text-brand-700",
        pending && "opacity-70",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <motion.span
          // Keyed on the saved state so the pulse plays on the transition
          // itself, not on every render of the card.
          key={String(saved)}
          initial={saved ? { scale: 0.7 } : false}
          animate={{ scale: 1 }}
          transition={{ duration: duration.normal, ease: ease.enter }}
          className="inline-flex"
        >
          <Heart
            aria-hidden
            className={cn(
              "size-4 transition-colors",
              saved && "fill-brand-700 text-brand-700",
            )}
          />
        </motion.span>
      )}
    </motion.button>
  );
}
