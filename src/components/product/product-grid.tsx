import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/product/product-card";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductCardData } from "@/lib/queries/products";

type ProductGridProps = {
  products: ProductCardData[];
  columns?: 2 | 3 | 4;
  className?: string;
  /** Cards before this index load their image eagerly. */
  priorityCount?: number;
};

/** Two up on mobile, three on tablet, four on desktop — with editorial gutters. */
const COLUMNS = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
} as const;

export function ProductGrid({
  products,
  columns = 4,
  className,
  priorityCount = 0,
}: ProductGridProps) {
  return (
    // One observer on the list schedules every card, rather than one per card.
    // The cards themselves stay server components — they are passed through as
    // children and never reach the browser bundle.
    <RevealGroup
      as="ul"
      className={cn("grid gap-x-4 gap-y-10 sm:gap-x-6 lg:gap-x-8", COLUMNS[columns], className)}
    >
      {products.map((product, index) => (
        <RevealItem key={product.id} as="li" className="flex">
          <ProductCard
            product={product}
            priority={index < priorityCount}
            className="w-full"
          />
        </RevealItem>
      ))}
    </RevealGroup>
  );
}

/** Matches the card's proportions so the swap does not shift layout. */
export function ProductGridSkeleton({
  count = 8,
  columns = 4,
}: {
  count?: number;
  columns?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn("grid gap-x-4 gap-y-10 sm:gap-x-6 lg:gap-x-8", COLUMNS[columns])}
      aria-hidden
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          <Skeleton className="aspect-[4/5] rounded-none" />
          <div className="space-y-2 pt-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
