import type { ReactNode } from "react";
import Link from "next/link";

import { Breadcrumbs, type Crumb } from "@/components/brand/breadcrumbs";
import { cn } from "@/lib/utils";

/**
 * Plum Studio building blocks for the learning section (Learn, Articles,
 * Tutorials, references).
 *
 * Server components, so a reading page still ships no JavaScript.
 */

/** The page ground. Same as the shop's, for the content routes. */
export function PlumGround({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-fill className={cn("font-figtree w-full flex-1 bg-pl-page text-pl-text", className)}>
      {children}
    </div>
  );
}

/** The 1280 column every plum page sits in, with the design's 32px gutters. */
export function PlumColumn({
  children,
  className,
  width = "max-w-[1280px]",
}: {
  children: ReactNode;
  className?: string;
  width?: string;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", width, className)}>{children}</div>
  );
}

/**
 * Page head — Figma "Page head" (21:1823): a full-width band on the subtle
 * ground, eyebrow, a 52px Bricolage title, an 18px lead, and an optional row
 * of filter tabs underneath.
 *
 * Breadcrumbs stay: they emit the `BreadcrumbList` structured data these pages
 * already carry, so they are kept above the eyebrow rather than dropped.
 */
export function PlumHero({
  crumbs,
  eyebrow,
  title,
  lead,
  children,
}: {
  crumbs: Crumb[];
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="bg-pl-subtle">
      <PlumColumn className="flex flex-col items-start gap-3.5 pt-6 pb-8 lg:pt-8">
        <Breadcrumbs items={crumbs} variant="plum" />
        <p className="pl-eyebrow mt-4">{eyebrow}</p>
        <h1 className="pl-display pl-h1 max-w-[760px]">{title}</h1>
        {lead && <p className="pl-lead max-w-[640px]">{lead}</p>}
        {children}
      </PlumColumn>
    </div>
  );
}

/** Segmented tab track (Figma "Filter tabs"): links, one marked current. */
export function PlumTabTrack({
  label,
  items,
}: {
  label: string;
  items: { key: string; label: ReactNode; href: string; current?: boolean }[];
}) {
  return (
    <nav
      aria-label={label}
      className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full bg-pl-sunken p-1"
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.current ? "page" : undefined}
          className={cn(
            "pl-focus font-figtree inline-flex h-9 shrink-0 items-center rounded-[12px] px-4 text-[14px] leading-[18px] font-bold whitespace-nowrap transition-colors",
            item.current
              ? "bg-pl-surface text-pl-text shadow-pl-sm"
              : "text-pl-muted hover:text-pl-text",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** A section heading with the design's H2 and an optional "view all" link. */
export function PlumSectionHead({
  id,
  title,
  href,
  hrefLabel,
}: {
  id?: string;
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 id={id} className="pl-display pl-h2">
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="pl-focus font-figtree rounded-sm text-sm leading-[22px] font-bold text-plum-500 underline-offset-4 hover:underline"
        >
          {hrefLabel ?? "View all"}
        </Link>
      )}
    </div>
  );
}

/**
 * A short list of related links — resources, tutorials, articles — each with
 * a glyph, a bold title and a one-line blurb. Rendered as a section so it keeps
 * the heading the structured pages already had.
 */
export function PlumLinkList({
  id,
  title,
  items,
  Icon,
}: {
  id: string;
  title: string;
  items: { key: string; href: string; title: string; blurb: string }[];
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  return (
    <section aria-labelledby={id} className="border-t border-pl-line pt-8">
      <h2 id={id} className="pl-h3">
        {title}
      </h2>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="pl-focus group flex items-start gap-3 rounded-[12px]"
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-plum-500" aria-hidden />
              <span className="min-w-0">
                <span className="block text-base leading-[22px] font-bold tracking-[-0.005em] text-pl-text underline-offset-4 group-hover:underline">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-sm leading-[22px] text-pl-muted">
                  {item.blurb}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "On this page" — Figma 27:2869: white 16px-radius card, plum links. */
export function PlumToc({
  label,
  items,
  ordered = false,
}: {
  label: string;
  items: { key: string; href: string; text: string }[];
  ordered?: boolean;
}) {
  const List = ordered ? "ol" : "ul";
  return (
    <nav
      aria-label={label}
      className="rounded-[16px] border border-pl-line bg-pl-surface p-5 lg:sticky lg:top-24"
    >
      <p className="text-base leading-[22px] font-bold tracking-[-0.005em]">{label}</p>
      <List className={cn("mt-2.5 space-y-2.5", ordered && "list-decimal pl-5 marker:text-pl-muted")}>
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="pl-focus rounded-sm text-sm leading-[22px] text-plum-500 underline-offset-4 hover:underline"
            >
              {item.text}
            </Link>
          </li>
        ))}
      </List>
    </nav>
  );
}
