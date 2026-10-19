import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleCardLink } from "@/components/content/article-card";
import { PlumColumn, PlumGround, PlumHero } from "@/components/content/plum";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { learnMetadata } from "@/lib/content/seo";
import { getTopic, listPublishedArticles } from "@/lib/queries/articles";

/**
 * One topic's articles.
 *
 * A topic with nothing published under it is a 404 rather than an empty page:
 * an index of nothing is the definition of a thin page, and it would be in the
 * sitemap for no reason.
 */
export async function generateMetadata({ params }: PageProps<"/blog/topic/[slug]">) {
  const { slug } = await params;
  const topic = await getTopic(slug);
  if (!topic) return { title: "Topic not found", robots: { index: false, follow: false } };

  return learnMetadata({
    title: `${topic.name} — crochet articles`,
    description: topic.description,
    path: `/blog/topic/${topic.slug}`,
  });
}

export default async function TopicPage({ params, searchParams }: PageProps<"/blog/topic/[slug]">) {
  const [{ slug }, raw] = await Promise.all([params, searchParams]);
  const page = Number(Array.isArray(raw.page) ? raw.page[0] : raw.page) || 1;

  const topic = await getTopic(slug);
  if (!topic) notFound();

  const { articles, page: current, pageCount, total } = await listPublishedArticles({ page, topicSlug: slug });
  if (articles.length === 0) notFound();

  return (
    <PlumGround>
      <PlumHero
        crumbs={[
          { label: "Learn", href: "/learn" },
          { label: "Articles", href: "/blog" },
          { label: topic.name },
        ]}
        eyebrow="Topic"
        title={topic.name}
        lead={topic.description}
      />

      <PlumColumn className="py-10 lg:py-14">

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <li key={article.slug}>
            <ArticleCardLink article={article} />
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm leading-[22px] text-pl-muted tabular-nums">
        {total} {total === 1 ? "article" : "articles"} in {topic.name}
      </p>

      <PaginationNav page={current} pageCount={pageCount} baseQuery="" basePath={`/blog/topic/${topic.slug}`} />

      <p className="mt-10 border-t border-pl-line pt-6">
        <Link href="/blog" className="pl-focus rounded-sm text-sm leading-[22px] font-bold text-plum-500 underline-offset-4 hover:underline">
          All articles
        </Link>
      </p>
      </PlumColumn>
    </PlumGround>
  );
}
