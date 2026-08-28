import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ButtonLink } from "@/components/ui/button-link";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { getAllCategories } from "@/lib/queries/categories";
import { staggerStep } from "@/lib/motion";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/**
 * Branded 404. Returns a real 404 status and offers a way onward — search, the
 * category list, and the shop — rather than bouncing the visitor to the
 * homepage and losing the signal that the URL was wrong.
 */
export default async function NotFound() {
  const categories = await getAllCategories();

  return (
    <>
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="container-page py-20 lg:py-28">
          {/* A staggered arrival gives the reader a beat to register that they
              hit a dead end before the ways out appear. */}
          <RevealGroup step={staggerStep.medium} onMount className="max-w-xl">
            <RevealItem as="p" className="label-caps text-brand-500">
              Error 404
            </RevealItem>

            <RevealItem>
              <h1 className="heading-hero mt-4">This page came undone</h1>
            </RevealItem>

            <RevealItem as="p" className="text-body mt-5">
              The link may be out of date, or the piece may have sold out and been
              retired. Everything else is still where you left it.
            </RevealItem>

            <RevealItem className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/shop" variant="brand" size="pill">
                Shop all pieces
              </ButtonLink>
              <ButtonLink href="/" variant="brandOutline" size="pill">
                Back to home
              </ButtonLink>
            </RevealItem>
          </RevealGroup>

          {categories.length > 0 && (
            <section className="mt-16 border-t border-border pt-10">
              <h2 className="label-caps text-muted-foreground">Browse a category</h2>

              <RevealGroup
                as="ul"
                className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
              >
                {categories.map((category) => (
                  <RevealItem key={category.id} as="li">
                    <Link
                      href={`/shop/${category.slug}`}
                      className="group/tile block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                    >
                      <span className="relative block aspect-square overflow-hidden bg-surface-alt">
                        {category.image && (
                          <Image
                            src={category.image}
                            alt=""
                            fill
                            sizes="(min-width: 1024px) 16vw, 45vw"
                            className="object-cover transition-transform duration-500 group-hover/tile:scale-105"
                          />
                        )}
                      </span>
                      <span className="mt-2 block text-sm font-medium">
                        {category.name}
                      </span>
                    </Link>
                  </RevealItem>
                ))}
              </RevealGroup>
            </section>
          )}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
