"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { addToCart } from "@/lib/actions/cart";
import { emitProductEvent } from "@/lib/product-events";
import { useCartUI } from "@/lib/stores/cart-ui";
import { plumButtonClass } from "@/components/ui/plum-button";

/**
 * "Add to cart" and "Buy now" — Plum Studio "Buy row" (19:1385).
 *
 *   primary   Buy / Large: marigold, 2px plum outline, 56px pill, takes the
 *             remaining width. The only marigold control on the page.
 *   secondary Secondary / Large: white, 1.5px outline.
 *
 * The two do different things on purpose. "Add To Cart" adds and opens the
 * drawer, leaving the shopper on the page. "Checkout Now" adds and then goes
 * straight to checkout — so it has to wait for the add to succeed before
 * navigating, or it would send someone to an empty bag.
 */
export function PdpBuyActions({
  productId,
  isAvailable,
}: {
  productId: string;
  isAvailable: boolean;
}) {
  const router = useRouter();
  const { setCount, open } = useCartUI();
  const [pending, startTransition] = useTransition();
  const [justAdded, setJustAdded] = useState(false);
  const [busy, setBusy] = useState<"cart" | "checkout" | null>(null);

  function add(then: "drawer" | "checkout") {
    setBusy(then === "drawer" ? "cart" : "checkout");

    startTransition(async () => {
      const result = await addToCart({ productId, quantity: 1 });

      if (!result.ok) {
        toast.error(result.error);
        setBusy(null);
        return;
      }

      setCount(result.data.itemCount);
      // Announced only after the add succeeded; nothing depends on a listener.
      emitProductEvent({ type: "cart-added", productId });

      if (then === "checkout") {
        // Deliberately not clearing `busy` — the button stays disabled through
        // the navigation so it cannot be pressed twice.
        router.push("/checkout");
        return;
      }

      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 1600);
      setBusy(null);
      open();
    });
  }

  if (!isAvailable) {
    return (
      <p
        role="status"
        className="font-figtree rounded-[20px] border border-pl-line bg-pl-surface px-6 py-4 text-center text-base text-pl-muted"
      >
        This piece isn&apos;t available to buy at the moment.
      </p>
    );
  }

  return (
    // Side by side from 380 up — comfortable at 390 and wider, where two pills
    // still clear 150px each. Stacked below that (320, 360), where a row would
    // squeeze both under the 44px target. `sm` (640) was too late: it left 390
    // and 430 stacked for no reason.
    <div className="flex flex-col gap-3 min-[380px]:flex-row min-[380px]:gap-3 sm:gap-4">
      {/* The design's primary is a full-height pill that takes the remaining
          width of the row (8211:1508 — `flex-1`, 60px radius). It is the one
          filled control on the page, so nothing else competes with it. */}
      <button
        type="button"
        onClick={() => add("drawer")}
        disabled={pending}
        aria-busy={pending}
        /* `min-[380px]:flex-1`, never a bare `flex-1`: below `sm` this row is a
           column, so `flex: 1 1 0%` would set a zero basis on the *vertical*
           axis and collapse the button to 24px — measured, at 320. Full width
           in the column, remaining width in the row. */
        className={plumButtonClass({
          style: "buy",
          size: "lg",
          className: "w-full min-[380px]:w-auto min-[380px]:flex-1",
        })}
      >
        {busy === "cart" ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : justAdded ? (
          <Check className="size-5" aria-hidden />
        ) : (
          <ShoppingBag className="size-5" aria-hidden />
        )}
        {justAdded ? "Added to bag" : "Add to cart"}
      </button>

      {/* Secondary, and visibly so: a hairline pill rather than a second
          filled button. Same behaviour as before — it adds, waits for the add
          to succeed, then navigates, so it can never land on an empty bag. */}
      <button
        type="button"
        onClick={() => add("checkout")}
        disabled={pending}
        aria-busy={pending}
        className={plumButtonClass({
          style: "secondary",
          size: "lg",
          className: "w-full shrink-0 min-[380px]:w-auto",
        })}
      >
        {busy === "checkout" && <Loader2 className="size-5 animate-spin" aria-hidden />}
        Buy now
      </button>
    </div>
  );
}
