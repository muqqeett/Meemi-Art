import Link from "next/link";

import { ArticleCardLink } from "@/components/content/article-card";
import { EmptyState } from "@/components/brand/empty-state";
import { PlumColumn, PlumGround, PlumHero, PlumTabTrack } from "@/components/content/plum";
import { plumButtonClass } from "@/components/ui/plum-button";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { BookOpen } from "lucide-react";
import { learnMetadata } from "@/lib/content/seo";
import { listPublishedArticles, listTopicsWithArticles } from "@/lib/queries/articles";

export const metadata = learnMetadata({
  title: "Crochet articles and guides",
  description:
    "Articles from Meemi Art on reading patterns, choosing hooks and yarn, and the techniques behind our crochet patterns — written for people learning the craft.",
  path: "/blog",
});

/**
 * The blog index.
 *
 * Only published articles are listed, and topics only appear when something
 * published sits under them — so a section is never an empty promise. With
 * nothing published the page says so plainly rather than showing a skeleton.
 */
export default async function BlogPage({ searchParams }: PageProps<"/blog">) {
  const raw = await searchParams;
  const page = Number(Array.isArray(raw.page) ? raw.page[0] : raw.page) || 1;

  const [{ articles, page: current, pageCount, total }, topics] = await Promise.all([
    listPublishedArticles({ page }),
    listTopicsWithArticles(),
  ]);

  return (
    <PlumGround>
      <PlumHero
        crumbs={[{ label: "Learn", href: "/learn" }, { label: "Articles" }]}
        eyebrow="Articles"
        title="Crochet articles and guides"
        lead={
          <>
            Longer pieces on the things patterns assume you already know — how to read them, what
            to make them with, and why a stitch behaves the way it does. For quick lookups, the{" "}
            <Link href="/learn" className="pl-focus rounded-sm text-plum-500 underline underline-offset-4">
              reference pages
            </Link>{" "}
            are faster.
          </>
        }
      >
        {topics.length > 0 && (
          <PlumTabTrack
            label="Article topics"
            items={[
              { key: "all", label: "All articles", href: "/blog", current: true },
              ...topics.map((topic) => ({
                key: topic.slug,
                label: (
                  <>
                    {topic.name}
                    <span className="ml-1.5 tabular-nums opacity-60">{topic.count}</span>
                  </>
                ),
                href: `/blog/topic/${topic.slug}`,
              })),
            ]}
          />
        )}
      </PlumHero>

      <PlumColumn className="py-10 lg:py-14">
      {articles.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={BookOpen}
          tone="plum"
          title="No articles published yet"
          description="Articles are written and edited before they go live, so this page stays empty until the first one is ready. The reference guides are already available."
          action={
            <Link href="/learn" className={plumButtonClass({ style: "primary", size: "md" })}>
              Browse the reference guides
            </Link>
          }
        />
      ) : (
        <>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <li key={article.slug}>
                <ArticleCardLink article={article} />
              </li>
            ))}
          </ul>

          <p className="mt-8 text-sm leading-[22px] text-pl-muted tabular-nums">
            {total} {total === 1 ? "article" : "articles"}
          </p>

          <PaginationNav page={current} pageCount={pageCount} baseQuery="" basePath="/blog" />
        </>
      )}
      </PlumColumn>
    </PlumGround>
  );
}
