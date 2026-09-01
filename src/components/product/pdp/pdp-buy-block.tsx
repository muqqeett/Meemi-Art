import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { PdpBuyActions } from "@/components/product/pdp/pdp-buy-actions";
import { WishlistButton } from "@/components/product/wishlist-button";

/**
 * The purchase block: the two CTAs, then the wishlist and refund line.
 *
 * Kept as one component and rendered **once**, because its position differs by
 * viewport but its state must not. On a phone it sits directly under the
 * gallery — the image is the hero, and the thing to do about it should be the
 * next thing you see, not something you reach after scrolling the title, the
 * price, the description and three tabs. On desktop it sits at the foot of the
 * detail column, where the eye lands after reading.
 *
 * That is done with grid placement rather than by rendering it twice: two
 * instances would each carry their own `justAdded` / `busy` state, so pressing
 * one would leave the other looking untouched, and a screen reader would meet
 * two "Add to cart" buttons for one product.
 */
export function PdpBuyBlock({
  productId,
  productName,
  isAvailable,
  isWishlisted,
}: {
  productId: string;
  productName: string;
  isAvailable: boolean;
  isWishlisted: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PdpBuyActions productId={productId} isAvailable={isAvailable} />

      {/* Compact by design — a row of two quiet controls, not a card. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <WishlistButton
          productId={productId}
          productName={productName}
          initialSaved={isWishlisted}
          variant="inline"
        />
        <Link
          href="/refunds"
          className="inline-flex items-center gap-2 text-sm text-pdp-body underline-offset-4 transition-colors hover:text-pdp-title hover:underline"
        >
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          14-day refund policy
        </Link>
      </div>
    </div>
  );
}
