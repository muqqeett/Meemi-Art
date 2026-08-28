"use client";

import { useState } from "react";

import { AddToCartButton } from "@/components/product/add-to-cart-button";
import { WishlistButton } from "@/components/product/wishlist-button";
import { QuantityStepper } from "@/components/cart/quantity-stepper";
import { Price } from "@/components/brand/price";
import { commerceConfig } from "@/lib/config";

type DigitalBuyBoxProps = {
  productId: string;
  productName: string;
  priceCents: number;
  compareAtCents: number | null;
  isAvailable: boolean;
  isWishlisted: boolean;
};

/**
 * The buy controls for a digital product.
 *
 * What used to be a variant picker is a price, a quantity and two buttons.
 * There is no size, no colourway and no stock counter, because none of those
 * exist for a file — inventing a "1 in stock" line would be a fiction, and a
 * disabled size grid would be worse.
 *
 * Quantity survives because a buyer may legitimately want several licences of
 * the same file.
 */
export function DigitalBuyBox({
  productId,
  productName,
  priceCents,
  compareAtCents,
  isAvailable,
  isWishlisted,
}: DigitalBuyBoxProps) {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="space-y-6">
      <Price priceCents={priceCents} compareAtCents={compareAtCents} size="lg" showBadge />

      {isAvailable ? (
        <>
          <div className="flex items-center gap-4">
            <span className="label-caps text-muted-foreground">Quantity</span>
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              max={commerceConfig.maxQuantityPerItem}
              label={productName}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <AddToCartButton
              productId={productId}
              quantity={quantity}
              label="Add to bag"
              size="pillLg"
              showIcon
              openDrawerOnSuccess
              className="flex-1 sm:flex-none"
            />
            <WishlistButton
              productId={productId}
              productName={productName}
              initialSaved={isWishlisted}
              variant="inline"
            />
          </div>
        </>
      ) : (
        <p
          role="status"
          className="border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning"
        >
          This piece isn&apos;t available to buy at the moment.
        </p>
      )}
    </div>
  );
}
