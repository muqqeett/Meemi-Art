import Link from "next/link";

import { ArticleCardLink } from "@/components/content/article-card";
import { Breadcrumbs } from "@/components/brand/breadcrumbs";
import { EmptyState } from "@/components/brand/empty-state";
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
    <div className="container-page max-w-5xl py-10 lg:py-14">
      <Breadcrumbs items={[{ label: "Learn", href: "/learn" }, { label: "Articles" }]} />

      <header className="mt-6 mb-10 border-b border-border pb-8">
        <p className="label-caps text-brand-600">Articles</p>
        <h1 className="heading-section mt-2">Crochet articles and guides</h1>
        <p className="text-body mt-4 max-w-2xl text-base leading-relaxed">
          Longer pieces on the things patterns assume you already know — how to
          read them, what to make them with, and why a stitch behaves the way it
          does. For quick lookups, the{" "}
          <Link href="/learn" className="text-brand-700 underline underline-offset-4">
            reference pages
          </Link>{" "}
          are faster.
        </p>
      </header>

      {topics.length > 0 && (
        <nav aria-label="Article topics" className="mb-8 flex flex-wrap gap-2">
          {topics.map((topic) => (
            <Link
              key={topic.slug}
              href={`/blog/topic/${topic.slug}`}
              className="inline-flex h-8 items-center rounded-md border border-border px-3 text-[0.8125rem] text-muted-foreground transition-colors duration-150 hover:border-brand-200 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              {topic.name}
              <span className="ml-1.5 tabular-nums opacity-60">{topic.count}</span>
            </Link>
          ))}
        </nav>
      )}

      {articles.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={BookOpen}
          title="No articles published yet"
          description="Articles are written and edited before they go live, so this page stays empty until the first one is ready. The reference guides are already available."
          action={
            <Link href="/learn" className="text-sm font-medium text-royal-600 hover:underline">
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

          <p className="text-body mt-8 text-xs tabular-nums">
            {total} {total === 1 ? "article" : "articles"}
          </p>

          <PaginationNav page={current} pageCount={pageCount} baseQuery="" basePath="/blog" />
        </>
      )}
    </div>
  );
}
