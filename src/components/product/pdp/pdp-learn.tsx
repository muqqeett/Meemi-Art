import Link from "next/link";
import { ArrowRight, GraduationCap, Newspaper } from "lucide-react";

import { contentForTechniques } from "@/lib/queries/content-links";

/**
 * "Learn with this pattern" — the guides that cover the techniques this
 * pattern uses.
 *
 * The match is the technique vocabulary Project Difficulty already stores
 * against the product, so nothing here is a hand-maintained list, and a
 * pattern gains the section the moment a matching piece is published.
 *
 * Renders nothing when there is no genuine match, and nothing when the
 * product has no difficulty profile — the same rule the learning pages use in
 * the other direction. A shop page with nothing relevant to teach is allowed
 * to simply sell.
 */
export async function PdpLearn({
  techniques,
  productName,
}: {
  techniques: readonly string[];
  productName: string;
}) {
  const content = await contentForTechniques(techniques, 4);
  if (content.length === 0) return null;

  return (
    <section aria-labelledby="pdp-learn">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="pdp-learn" className="heading-sub">
          Learn with this pattern
        </h2>
        <Link
          href="/learn"
          className="text-sm font-medium text-brand-700 underline-offset-4 hover:underline"
        >
          All guides
        </Link>
      </div>
      <p className="text-body mt-3 max-w-2xl text-sm leading-relaxed">
        Free guides covering the techniques {productName} uses. No account needed.
      </p>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {content.map((item) => {
          const Icon = item.kind === "tutorial" ? GraduationCap : Newspaper;
          return (
            <li key={`${item.kind}-${item.slug}`}>
              <Link
                href={item.kind === "tutorial" ? `/tutorials/${item.slug}` : `/blog/${item.slug}`}
                className="group flex h-full flex-col rounded-sm border border-border bg-card p-5 transition-colors duration-200 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <span className="flex items-center gap-2 text-brand-600">
                  <Icon className="size-4" aria-hidden />
                  <span className="label-caps">{item.kind === "tutorial" ? "Tutorial" : "Article"}</span>
                </span>
                <span className="mt-3 block text-base leading-snug font-medium text-foreground group-hover:text-brand-700">
                  {item.title}
                </span>
                <span className="text-body mt-2 block flex-1 text-sm leading-relaxed">{item.excerpt}</span>
                <span className="text-body mt-4 flex items-center gap-1.5 text-xs font-medium text-brand-700">
                  Read it
                  <ArrowRight
                    className="size-3 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
