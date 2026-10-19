import type { ReactNode } from "react";
import Link from "next/link";

import type { Crumb } from "@/components/brand/breadcrumbs";
import { PlumColumn, PlumGround, PlumHero } from "@/components/content/plum";
import { headingId } from "@/lib/content/blocks";
import { cn } from "@/lib/utils";

/**
 * The shell every reference page shares, in the Plum Studio style.
 *
 * Page head on the subtle band (eyebrow, 52px title, lead), then a 900px
 * reading column: reference tables need more room than prose, and prose stops
 * being readable past about seventy characters a line. Breadcrumbs come first
 * and carry their own `BreadcrumbList` structured data.
 *
 * Server components throughout — a reference page ships no JavaScript to read.
 */
export function LearnPage({
  eyebrow,
  title,
  intro,
  crumbs,
  contents,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  crumbs: Crumb[];
  /** Section headings, rendered as an "on this page" list. */
  contents?: string[];
  children: ReactNode;
}) {
  return (
    <PlumGround>
      <PlumHero crumbs={crumbs} eyebrow={eyebrow} title={title} lead={intro} />

      <PlumColumn width="max-w-[1000px]" className="py-10 lg:py-14">
        {contents && contents.length > 1 && (
          <nav
            aria-label="On this page"
            className="mb-10 rounded-[16px] border border-pl-line bg-pl-surface p-5"
          >
            <p className="text-base leading-[22px] font-bold tracking-[-0.005em]">On this page</p>
            <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {contents.map((entry) => (
                <li key={entry}>
                  <Link
                    href={`#${headingId(entry)}`}
                    className="pl-focus rounded-sm text-sm leading-[22px] text-plum-500 underline-offset-4 hover:underline"
                  >
                    {entry}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="space-y-12">{children}</div>
      </PlumColumn>
    </PlumGround>
  );
}

/** A section with a stable anchor, so "on this page" and shared links work. */
export function LearnSection({
  title,
  lead,
  children,
  className,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={headingId(title)} className={cn("scroll-mt-24", className)}>
      <h2 className="pl-display pl-h2">{title}</h2>
      {lead && <p className="pl-body mt-3 max-w-2xl text-pl-muted">{lead}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

/** Body copy at a readable measure, used inside sections. */
export function LearnProse({ children }: { children: ReactNode }) {
  return <div className="pl-body max-w-2xl space-y-4 text-pl-muted">{children}</div>;
}
