import type { ReactNode } from "react";

import { Breadcrumbs, type Crumb } from "@/components/brand/breadcrumbs";

/**
 * Plum Studio listing header — Figma "Page head" (17:896): breadcrumbs, a 52px
 * Bricolage title and an 18px lead, on 32px padding.
 *
 * The lead is real copy supplied by the page, not the design's placeholder
 * ("Crochet patterns, templates, printables and creator assets…" describes a
 * catalogue this shop does not have).
 */
export function PlumPageHead({
  crumbs,
  title,
  lead,
}: {
  crumbs: Crumb[];
  title: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 pt-6 pb-6 lg:pt-8">
      <Breadcrumbs items={crumbs} variant="plum" />
      <h1 className="pl-display pl-h1">{title}</h1>
      {lead && <p className="pl-lead max-w-[640px]">{lead}</p>}
    </header>
  );
}

/** The ground and gutters every Plum Studio listing page sits on. */
export function PlumPage({ children }: { children: ReactNode }) {
  return (
    <div data-fill className="font-figtree w-full flex-1 bg-pl-page text-pl-text">
      <div className="mx-auto w-full max-w-[1280px] px-4 pb-20 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}
