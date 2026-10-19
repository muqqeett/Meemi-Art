import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  PlumColumn,
  PlumGround,
  PlumHero,
  PlumSectionHead,
  PlumTabTrack,
} from "@/components/content/plum";
import { plumButtonClass } from "@/components/ui/plum-button";
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
 * The way into everything written rather than sold — Plum Studio "Learn"
 * (21:1782): a page head with tabs, then a three-column grid of cards.
 *
 * The design's tabs filter guides by category (Crochet basics, Projects,
 * Templates, Selling). This section's real divisions are articles, tutorials
 * and references, each with its own page, so the track links to those instead
 * of inventing categories.
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
    <PlumGround>
      <PlumHero
        crumbs={[{ label: "Learn" }]}
        eyebrow="Learn"
        title="Crochet guides and references"
        lead="Reference material we keep because we need it ourselves: what the abbreviations mean, which hook matches which yarn, and how to read the line of a pattern that has stopped making sense. Free to use, no account needed, and written to be checked mid-project rather than read end to end."
      >
        {/* The three kinds of thing in this section, always reachable. The
            recent-article and recent-tutorial strips further down appear only
            once something is published, which left the indexes with no entry
            point at all while they were empty. These do not depend on content
            existing: each index states its own empty case. */}
        <PlumTabTrack
          label="Browse the learning section"
          items={[
            { key: "all", label: "All guides", href: "/learn", current: true },
            { key: "articles", label: "Articles", href: "/blog" },
            { key: "tutorials", label: "Tutorials", href: "/tutorials" },
            { key: "references", label: "References", href: "#references" },
          ]}
        />
      </PlumHero>

      <PlumColumn className="flex flex-col gap-14 py-10 lg:py-14">
        <section aria-labelledby="references" className="scroll-mt-24">
          <PlumSectionHead id="references" title="References" />

          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {RESOURCES.map((resource) => (
              <li key={resource.slug}>
                <Link
                  href={resourcePath(resource.slug)}
                  className="pl-focus group flex h-full flex-col gap-1.5 rounded-[20px] bg-pl-subtle p-5 transition-colors hover:bg-plum-100"
                >
                  <span className="pl-eyebrow">{resource.shortTitle}</span>
                  <span className="pl-h3 block group-hover:underline group-hover:underline-offset-4">
                    {resource.title}
                  </span>
                  <span className="block flex-1 text-sm leading-[22px] text-pl-muted">
                    {resource.description}
                  </span>
                  <span className="mt-2 block text-[13px] leading-[18px] font-medium text-pl-muted">
                    <span className="font-bold text-pl-text">Useful if:</span> {resource.audience}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {tutorials.length > 0 && (
          <section aria-labelledby="recent-tutorials">
            <PlumSectionHead
              id="recent-tutorials"
              title="Step-by-step tutorials"
              href="/tutorials"
              hrefLabel="All tutorials"
            />
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tutorials.map((tutorial) => (
                <li key={tutorial.slug}>
                  <TutorialCardLink tutorial={tutorial} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {articles.length > 0 && (
          <section aria-labelledby="recent-articles">
            <PlumSectionHead
              id="recent-articles"
              title="Latest articles"
              href="/blog"
              hrefLabel="All articles"
            />
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <li key={article.slug}>
                  <ArticleCardLink article={article} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col items-start gap-3 rounded-[20px] bg-plum-900 p-6 text-pl-on-dark sm:p-8">
          <h2 className="pl-h3 !text-pl-on-dark">Looking for something to make?</h2>
          <p className="max-w-2xl text-base leading-[26px] text-plum-200">
            Our patterns are written PDFs with stitch counts for every round, so the references
            above are the same language the patterns use.
          </p>
          <Link href="/shop" className={plumButtonClass({ style: "ghost", size: "md" })}>
            Browse crochet patterns
            <ArrowRight className="size-5" aria-hidden />
          </Link>
        </section>
      </PlumColumn>
    </PlumGround>
  );
}
