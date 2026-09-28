import Link from "next/link";
import { ArrowRight, BookOpen, Compass, GraduationCap, Newspaper } from "lucide-react";

import { Breadcrumbs } from "@/components/brand/breadcrumbs";
import { RESOURCES, resourcePath } from "@/lib/content/resources";
import { learnMetadata } from "@/lib/content/seo";
import { recentArticles } from "@/lib/queries/articles";
import { recentTutorials } from "@/lib/queries/tutorials";
import { ArticleCardLink } from "@/components/content/article-card";
import { TutorialCardLink } from "@/components/content/tutorial-card";

export const metadata = learnMetadata({
  title: "Learn crochet — guides and references",
  description:
    "Free crochet references from Meemi Art: a beginner's guide, pattern notation explained, an abbreviation dictionary, hook size conversions and a yarn weight guide.",
  path: "/learn",
});

/**
 * The way into everything written rather than sold.
 *
 * Deliberately a short page: its job is to send a reader to the right
 * reference in one click, not to restate what each one says. Every card links
 * to a page that exists and is finished — nothing here is a promise of content
 * to come.
 */
export default async function LearnPage() {
  // Articles and tutorials appear here only once something is published — an
  // empty section would be a promise rather than a page.
  const [articles, tutorials] = await Promise.all([recentArticles(3), recentTutorials(3)]);

  return (
    <div className="container-page max-w-4xl py-10 lg:py-14">
      <Breadcrumbs items={[{ label: "Learn" }]} />

      <header className="mt-6 mb-12 border-b border-border pb-8">
        <p className="label-caps text-brand-600">Learn</p>
        <h1 className="heading-section mt-2">Crochet guides and references</h1>
        <p className="text-body mt-4 max-w-2xl text-base leading-relaxed">
          Reference material we keep because we need it ourselves: what the
          abbreviations mean, which hook matches which yarn, and how to read the
          line of a pattern that has stopped making sense. Free to use, no
          account needed, and written to be checked mid-project rather than read
          end to end.
        </p>
      </header>

      {/* The three kinds of thing in this section, always reachable.
          The recent-article and recent-tutorial strips further down appear only
          once something is published, which left the indexes with no entry
          point at all while they were empty. These three do not depend on
          content existing: each index states its own empty case. */}
      <nav aria-label="Browse the learning section" className="mb-10 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/blog", label: "Articles", blurb: "How patterns, hooks and yarn actually work", Icon: Newspaper },
          { href: "/tutorials", label: "Tutorials", blurb: "One skill at a time, written as steps", Icon: GraduationCap },
          { href: "#references", label: "References", blurb: "Tables to check mid-project", Icon: BookOpen },
        ].map(({ href, label, blurb, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-3 rounded-sm border border-border bg-surface-alt/50 px-4 py-3.5 transition-colors duration-200 hover:border-brand-300 hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground group-hover:text-brand-700">{label}</span>
              <span className="text-body mt-0.5 block text-xs leading-relaxed">{blurb}</span>
            </span>
          </Link>
        ))}
      </nav>

      <h2 id="references" className="heading-sub mb-5 scroll-mt-24">
        References
      </h2>

      <ul className="grid gap-5 sm:grid-cols-2">
        {RESOURCES.map((resource) => (
          <li key={resource.slug}>
            <Link
              href={resourcePath(resource.slug)}
              className="group flex h-full flex-col rounded-sm border border-border bg-card p-6 transition-colors duration-200 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <span className="flex items-center gap-2 text-brand-600">
                <BookOpen className="size-4" aria-hidden />
                <span className="label-caps">{resource.shortTitle}</span>
              </span>
              <span className="mt-3 block text-lg font-medium text-foreground group-hover:text-brand-700">
                {resource.title}
              </span>
              <span className="text-body mt-2 block flex-1 text-sm leading-relaxed">
                {resource.description}
              </span>
              <span className="text-body mt-4 block text-xs">
                <span className="font-medium text-foreground">Useful if:</span> {resource.audience}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {tutorials.length > 0 && (
        <section aria-labelledby="recent-tutorials" className="mt-14 border-t border-border pt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="recent-tutorials" className="heading-sub">
              Step-by-step tutorials
            </h2>
            <Link href="/tutorials" className="text-sm font-medium text-brand-700 underline-offset-4 hover:underline">
              All tutorials
            </Link>
          </div>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tutorials.map((tutorial) => (
              <li key={tutorial.slug}>
                <TutorialCardLink tutorial={tutorial} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {articles.length > 0 && (
        <section aria-labelledby="recent-articles" className="mt-14 border-t border-border pt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="recent-articles" className="heading-sub">
              Latest articles
            </h2>
            <Link href="/blog" className="text-sm font-medium text-brand-700 underline-offset-4 hover:underline">
              All articles
            </Link>
          </div>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <li key={article.slug}>
                <ArticleCardLink article={article} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 rounded-sm border border-border bg-surface-alt/60 px-6 py-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Compass className="size-4 text-brand-600" aria-hidden />
          Looking for something to make?
        </h2>
        <p className="text-body mt-2 max-w-2xl text-sm leading-relaxed">
          Our patterns are written PDFs with stitch counts for every round, so
          the references above are the same language the patterns use.
        </p>
        <Link
          href="/shop"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 underline-offset-4 hover:underline"
        >
          Browse crochet patterns
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
