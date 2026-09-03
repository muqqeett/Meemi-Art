"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";

import { addToCart } from "@/lib/actions/cart";
import { useCartUI } from "@/lib/stores/cart-ui";

/**
 * "Add To Cart" and "Checkout Now" — Figma 57:1411.
 *
 *   row       24px apart, 520 wide
 *   primary   #141414, 8px radius, 296 wide, Clash Grotesk Semibold 20/1.2
 *   secondary white with a #B8B8B8 hairline, 200 × 58, Clash Grotesk Medium
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
        className="rounded-[3px] border border-pdp-border px-6 py-4 text-center text-base text-pdp-body"
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
        className="inline-flex h-14 w-full items-center justify-center rounded-[3px] bg-brand-700 px-6 text-[0.8125rem] font-semibold tracking-[0.14em] text-white uppercase transition-[background-color,transform] duration-200 hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 active:translate-y-px active:bg-brand-800 disabled:pointer-events-none disabled:opacity-60 min-[380px]:w-auto min-[380px]:flex-1"
      >
        {busy === "cart" ? (
          <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
        ) : justAdded ? (
          <Check className="mr-2 size-5" aria-hidden />
        ) : null}
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
        className="inline-flex h-14 w-full shrink-0 items-center justify-center rounded-[3px] border border-brand-700/35 bg-transparent px-6 text-[0.8125rem] font-semibold tracking-[0.14em] text-pdp-title uppercase transition-[background-color,border-color,transform] duration-200 hover:border-brand-700/60 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 active:translate-y-px disabled:pointer-events-none disabled:opacity-60 min-[380px]:w-[150px] sm:w-[170px]"
      >
        {busy === "checkout" && <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />}
        Buy now
      </button>
    </div>
  );
}
