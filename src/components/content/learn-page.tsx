import type { ReactNode } from "react";
import Link from "next/link";

import { Breadcrumbs, type Crumb } from "@/components/brand/breadcrumbs";
import { headingId } from "@/lib/content/blocks";
import { cn } from "@/lib/utils";

/**
 * The shell every learning page shares.
 *
 * Wider than the policy pages, because reference tables need the room, and
 * narrower than the shop, because prose stops being readable past about
 * seventy characters a line. Breadcrumbs come first and carry their own
 * `BreadcrumbList` structured data.
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
    <div className="container-page max-w-4xl py-10 lg:py-14">
      <Breadcrumbs items={crumbs} />

      <header className="mt-6 mb-10 border-b border-border pb-8">
        <p className="label-caps text-brand-600">{eyebrow}</p>
        <h1 className="heading-section mt-2">{title}</h1>
        <p className="text-body mt-4 max-w-2xl text-base leading-relaxed">{intro}</p>
      </header>

      {contents && contents.length > 1 && (
        <nav aria-label="On this page" className="mb-10 rounded-sm border border-border bg-surface-alt/60 px-5 py-4">
          <p className="label-caps text-muted-foreground">On this page</p>
          <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {contents.map((entry) => (
              <li key={entry}>
                <Link
                  href={`#${headingId(entry)}`}
                  className="text-sm text-foreground underline-offset-4 hover:text-brand-600 hover:underline"
                >
                  {entry}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="space-y-12">{children}</div>
    </div>
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
      <h2 className="heading-sub">{title}</h2>
      {lead && <p className="text-body mt-3 max-w-2xl leading-relaxed">{lead}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

/** Body copy at a readable measure, used inside sections. */
export function LearnProse({ children }: { children: ReactNode }) {
  return <div className="text-body max-w-2xl space-y-4 leading-relaxed">{children}</div>;
}
