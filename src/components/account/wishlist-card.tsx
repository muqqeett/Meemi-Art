"use client";

import { useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AddToCartButton } from "@/components/product/add-to-cart-button";
import { Price } from "@/components/brand/price";
import { StarRating } from "@/components/brand/star-rating";
import { removeFromWishlist } from "@/lib/actions/wishlist";
import type { ProductCardData } from "@/lib/queries/products";

/**
 * Wishlist row: shows live price and availability, moves the item to the bag,
 * or removes it.
 */
export function WishlistCard({ product }: { product: ProductCardData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await removeFromWishlist(product.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${product.name} removed from your wishlist`);
      router.refresh();
    });
  }

  return (
    <li
      className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card data-[pending=true]:opacity-60"
      data-pending={pending}
    >
      <Link
        href={`/products/${product.slug}`}
        className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-surface-alt"
      >
        {product.imageUrl && (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt}
            fill
            sizes="96px"
            className="object-contain"
          />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">
          {product.brand}
        </p>
        <h3 className="mt-0.5 font-medium text-foreground">
          <Link href={`/products/${product.slug}`} className="hover:text-brand-600">
            {product.name}
          </Link>
        </h3>

        {product.reviewCount > 0 && (
          <StarRating
            value={product.ratingAvg}
            count={product.reviewCount}
            size="sm"
            className="mt-1"
          />
        )}

        <div className="mt-2 flex items-center gap-3">
          <Price priceCents={product.priceCents} compareAtCents={product.compareAtCents} />
          {!product.isAvailable && (
            <span className="text-sm font-medium text-destructive">Unavailable</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <AddToCartButton
          productId={product.id}
          disabled={!product.isAvailable}
          unavailableLabel="Unavailable"
          label="Move to bag"
          size="pill"
          openDrawerOnSuccess
        />

        <Button
          type="button"
          variant="ghost"
          size="iconPill"
          onClick={remove}
          disabled={pending}
          aria-label={`Remove ${product.name} from wishlist`}
        >
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Trash2 aria-hidden />
          )}
        </Button>
      </div>
    </li>
  );
}
