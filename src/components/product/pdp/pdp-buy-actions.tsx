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
        className="font-clash rounded-[8px] border border-pdp-border px-6 py-4 text-base text-pdp-body"
      >
        This piece isn&apos;t available to buy at the moment.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
      <button
        type="button"
        onClick={() => add("drawer")}
        disabled={pending}
        className="font-clash inline-flex h-[58px] items-center justify-center rounded-[8px] bg-pdp-price px-8 text-xl leading-[1.2] font-semibold text-white transition-transform duration-200 ease-out hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pdp-price active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:scale-100 sm:w-[296px]"
      >
        {busy === "cart" ? (
          <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
        ) : justAdded ? (
          <Check className="mr-2 size-5" aria-hidden />
        ) : null}
        {justAdded ? "Added" : "Add To Cart"}
      </button>

      <button
        type="button"
        onClick={() => add("checkout")}
        disabled={pending}
        className="font-clash inline-flex h-[58px] items-center justify-center rounded-[8px] border border-pdp-border bg-white px-8 text-xl leading-[1.2] font-medium text-[#333] transition-colors hover:bg-pdp-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pdp-price disabled:pointer-events-none disabled:opacity-60 sm:w-[200px]"
      >
        {busy === "checkout" && <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />}
        Checkout Now
      </button>
    </div>
  );
}
