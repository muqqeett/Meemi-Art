import Image from "next/image";
import Link from "next/link";

import { Breadcrumbs, type Crumb } from "@/components/brand/breadcrumbs";
import type { ShopCategorySpec } from "@/lib/shop-categories";
import { cn } from "@/lib/utils";

export type CategoryChip = { label: string; href: string; selected: boolean };

/** Resting tint when a category is not one of the design's five. */
const FALLBACK_TINT = "bg-pl-tint-crochet";

/**
 * The category's character, top right of the band — 200px on desktop, 64px on
 * a phone. Only the design's five have one; any other category gets a plain
 * band rather than someone else's mascot.
 */
function Cast({ spec }: { spec: ShopCategorySpec }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-3.5 right-4 block size-16 sm:right-6 lg:top-4 lg:right-[72px] lg:size-[200px]"
    >
      <span className="absolute" style={{ inset: spec.placement.group }}>
        <span className="absolute" style={{ inset: spec.placement.bleed }}>
          <Image src={spec.art} alt="" fill unoptimized className="max-w-none object-fill" />
        </span>
      </span>
    </span>
  );
}

function Chips({ chips, className }: { chips: CategoryChip[]; className?: string }) {
  return (
    <nav aria-label="Subcategories" className={className}>
      <ul className="no-scrollbar flex gap-2 overflow-x-auto py-0.5">
        {chips.map((chip) => (
          <li key={chip.href} className="shrink-0">
            <Link
              href={chip.href}
              aria-current={chip.selected ? "page" : undefined}
              className={cn(
                "pl-focus font-figtree inline-flex h-9 items-center rounded-full border-[1.5px] px-3 text-[14px] leading-[18px] font-bold whitespace-nowrap transition-colors",
                chip.selected
                  ? "border-plum-900 bg-pl-inverse text-pl-on-dark"
                  : "border-pl-line bg-pl-surface text-pl-text hover:bg-plum-100",
              )}
            >
              {chip.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Category page head — Figma "Page head" (171:6009, mobile 173:2182).
 *
 * A band in the category's tint with its character, breadcrumbs, the name, and
 * one line giving the description and the live count. The sub-category chips
 * are links, not filters; on desktop they sit inside the band, on a phone they
 * are their own scrolling row beneath it, as drawn.
 */
export function CategoryHead({
  crumbs,
  title,
  lead,
  spec,
  chips,
}: {
  crumbs: Crumb[];
  title: string;
  lead: string;
  spec?: ShopCategorySpec;
  chips: CategoryChip[];
}) {
  return (
    <>
      <section className={cn("font-figtree", spec?.tint ?? FALLBACK_TINT)}>
        <div className="relative mx-auto w-full max-w-[1280px] px-4 pt-5 pb-4 sm:px-6 lg:px-8 lg:pt-8 lg:pb-7">
          <div className="flex flex-col items-start gap-2 pr-20 lg:gap-3 lg:pr-0">
            <Breadcrumbs items={crumbs} variant="plum" />
            <h1 className="pl-display max-w-[640px] text-[36px] leading-10 tracking-[-0.022em] lg:text-[52px] lg:leading-[56px] lg:tracking-[-0.03em]">
              {title}
            </h1>
            <p className="font-figtree text-sm leading-[22px] text-pl-muted lg:max-w-[640px] lg:text-lg lg:leading-7">{lead}</p>
            {chips.length > 0 && <Chips chips={chips} className="hidden max-w-full pt-1 lg:block" />}
          </div>
          {spec && <Cast spec={spec} />}
        </div>
      </section>
      {chips.length > 0 && (
        <Chips
          chips={chips}
          className="mx-auto w-full max-w-[1280px] px-4 pt-4 sm:px-6 lg:hidden"
        />
      )}
    </>
  );
}
