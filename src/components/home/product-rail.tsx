import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { SectionHeader } from "@/components/brand/section-header";
import { ProductCard } from "@/components/product/product-card";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/lib/queries/products";

type ProductRailProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  products: ProductCardData[];
  viewAllHref: string;
  viewAllLabel?: string;
  /** `rail` scrolls horizontally on small screens; `grid` always wraps. */
  layout?: "rail" | "grid";
  className?: string;
  priority?: boolean;
};

/**
 * A titled row of products, used for both New Arrivals and Best Sellers.
 *
 * On small screens the `rail` layout scrolls horizontally with snap points,
 * which shows more of the range than a two-up grid would in the same vertical
 * space. It becomes a four-column grid from `md` upwards.
 */
export function ProductRail({
  eyebrow,
  title,
  description,
  products,
  viewAllHref,
  viewAllLabel = "View all",
  layout = "grid",
  className,
  priority = false,
}: ProductRailProps) {
  if (products.length === 0) return null;

  const isRail = layout === "rail";

  return (
    <section className={cn("section-y", className)}>
      <div className="container-page">
        <Reveal>
          <SectionHeader
            eyebrow={eyebrow}
            title={title}
            description={description}
            align="start"
            action={
              <Link
                href={viewAllHref}
                className="label-caps hidden items-center gap-2 text-brand-600 hover:underline sm:inline-flex"
              >
                {viewAllLabel}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
        </Reveal>
      </div>

      {isRail ? (
        <>
          {/* Full-bleed rail on mobile so cards can run to the screen edge.
              The rail scrolls horizontally, so cards past the fold would never
              trip a viewport observer — this one reveals on mount instead. */}
          <RevealGroup
            as="ul"
            onMount
            className="no-scrollbar snap-rail mt-10 flex gap-4 overflow-x-auto px-5 sm:px-8 md:hidden"
          >
            {products.map((product, index) => (
              <RevealItem
                key={product.id}
                as="li"
                className="w-[62vw] shrink-0 max-[420px]:w-[72vw]"
              >
                <ProductCard product={product} priority={priority && index < 2} />
              </RevealItem>
            ))}
          </RevealGroup>

          <div className="container-page hidden md:block">
            <RevealGroup
              as="ul"
              className="mt-10 grid grid-cols-3 gap-x-6 gap-y-10 xl:grid-cols-4 xl:gap-x-8"
            >
              {products.slice(0, 4).map((product, index) => (
                <RevealItem key={product.id} as="li">
                  <ProductCard product={product} priority={priority && index < 4} />
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </>
      ) : (
        <div className="container-page">
          <RevealGroup
            as="ul"
            className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 sm:gap-x-6 lg:gap-x-8 xl:grid-cols-4"
          >
            {products.map((product, index) => (
              <RevealItem key={product.id} as="li">
                <ProductCard product={product} priority={priority && index < 4} />
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      )}

      <div className="container-page mt-10 sm:hidden">
        <ButtonLink href={viewAllHref} variant="brandOutline" size="pill" className="w-full">
          {viewAllLabel}
        </ButtonLink>
      </div>
    </section>
  );
}
