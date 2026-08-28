import type { Metadata } from "next";
import { Heart } from "lucide-react";

import { WishlistCard } from "@/components/account/wishlist-card";
import { EmptyState } from "@/components/brand/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { requireUser } from "@/lib/auth-guards";
import { getWishlistProducts } from "@/lib/queries/wishlist";

export const metadata: Metadata = {
  title: "Your wishlist",
  robots: { index: false, follow: false },
};

export default async function WishlistPage() {
  const user = await requireUser("/account/wishlist");
  const products = await getWishlistProducts(user.id);

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card shadow-card">
        <EmptyState
          icon={Heart}
          title="Your wishlist is empty"
          description="Tap the heart on any product to save it here. We'll keep an eye on price and availability for you."
          action={
            <ButtonLink href="/shop" variant="brand" size="pill">
              Find something you love
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-foreground">Your wishlist</h2>
      <p className="text-body mb-6">
        {products.length} saved {products.length === 1 ? "item" : "items"}
      </p>

      <ul className="space-y-4">
        {products.map((product) => (
          <WishlistCard key={product.id} product={product} />
        ))}
      </ul>
    </div>
  );
}
