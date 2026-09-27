import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, GraduationCap } from "lucide-react";

import { ArticleCardLink } from "@/components/content/article-card";
import { Breadcrumbs } from "@/components/brand/breadcrumbs";
import { ContentBlocks } from "@/components/content/content-blocks";
import { RelatedPatterns } from "@/components/content/related-patterns";
import { outline } from "@/lib/content/blocks";
import { resourcePath } from "@/lib/content/resources";
import { learnMetadata } from "@/lib/content/seo";
import { entityIds, siteConfig } from "@/lib/config";
import { safeJsonLd } from "@/lib/json-ld";
import { getArticleRelations, getPublishedArticle } from "@/lib/queries/articles";

/**
 * One article.
 *
 * A draft returns a 404 — the same answer as a slug that never existed — so an
 * unpublished piece cannot be read by guessing its URL, and nothing links to
 * it, lists it or puts it in the sitemap.
 *
 * The byline is Meemi Art, the shop itself. There is no invented author and no
 * claimed credential: the structured data says publisher, which is what is
 * true.
 */
export async function generateMetadata({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) return { title: "Article not found", robots: { index: false, follow: false } };

  return learnMetadata({
    title: article.seoTitle ?? article.title,
    description: article.seoDescription ?? article.excerpt,
    path: `/blog/${article.slug}`,
    type: "article",
    image: article.coverImageUrl ? { url: article.coverImageUrl, alt: article.coverImageAlt ?? article.title } : null,
    publishedTime: article.publishedAt.toISOString(),
    modifiedTime: article.updatedAt.toISOString(),
    canonicalOverride: article.canonicalUrl,
  });
}

export default async function ArticlePage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) notFound();

  const related = await getArticleRelations(article);
  const sections = outline(article.body);
  const url = `${siteConfig.url}/blog/${article.slug}`;

  /**
   * Article structured data. Only fields that are true and visible on the page:
   * a headline, the dates, the publisher. No author person, no rating, no
   * invented image.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    url,
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    inLanguage: "en",
    isAccessibleForFree: true,
    author: { "@id": entityIds.organization },
    publisher: { "@id": entityIds.organization },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(article.coverImageUrl ? { image: [article.coverImageUrl] } : {}),
    ...(article.topic ? { articleSection: article.topic.name } : {}),
    ...(article.tags.length > 0 ? { keywords: article.tags.join(", ") } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <article className="container-page max-w-3xl py-10 lg:py-14">
        <Breadcrumbs
          items={[
            { label: "Learn", href: "/learn" },
            { label: "Articles", href: "/blog" },
            { label: article.title },
          ]}
        />

        <header className="mt-6 mb-8 border-b border-border pb-8">
          {article.topic && (
            <Link href={`/blog/topic/${article.topic.slug}`} className="label-caps text-brand-600 hover:underline">
              {article.topic.name}
            </Link>
          )}
          <h1 className="heading-section mt-2">{article.title}</h1>
          <p className="text-body mt-4 text-base leading-relaxed">{article.excerpt}</p>
          <p className="text-body mt-5 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-foreground">{siteConfig.name}</span>
            <span aria-hidden className="opacity-40">·</span>
            <time dateTime={article.publishedAt.toISOString()}>
              {article.publishedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </time>
            <span aria-hidden className="opacity-40">·</span>
            <span>{article.readingMinutes} min read</span>
          </p>
        </header>

        {article.coverImageUrl && (
          <figure className="mb-10 overflow-hidden rounded-sm border border-border bg-surface-alt">
            <Image
              src={article.coverImageUrl}
              alt={article.coverImageAlt ?? ""}
              width={1200}
              height={675}
              sizes="(min-width: 768px) 48rem, 100vw"
              className="h-auto w-full object-cover"
              priority
            />
          </figure>
        )}

        {sections.length > 2 && (
          <nav aria-label="On this page" className="mb-10 rounded-sm border border-border bg-surface-alt/60 px-5 py-4">
            <p className="label-caps text-muted-foreground">On this page</p>
            <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {sections.map((section) => (
                <li key={section.id}>
                  <Link
                    href={`#${section.id}`}
                    className="text-sm text-foreground underline-offset-4 hover:text-brand-600 hover:underline"
                  >
                    {section.text}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <ContentBlocks blocks={article.body} />

        {related.resources.length > 0 && (
          <section aria-labelledby="related-resources" className="mt-12 border-t border-border pt-8">
            <h2 id="related-resources" className="heading-sub">
              Keep these to hand
            </h2>
            <ul className="mt-4 space-y-2.5">
              {related.resources.map((resource) => (
                <li key={resource.slug}>
                  <Link
                    href={resourcePath(resource.slug)}
                    className="group flex items-start gap-2.5 text-sm text-foreground hover:text-brand-700"
                  >
                    <BookOpen className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                    <span>
                      <span className="font-medium underline-offset-4 group-hover:underline">{resource.title}</span>
                      <span className="text-body mt-0.5 block text-xs leading-relaxed">{resource.description}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {related.tutorials.length > 0 && (
          <section aria-labelledby="related-tutorials" className="mt-12 border-t border-border pt-8">
            <h2 id="related-tutorials" className="heading-sub">
              Try it step by step
            </h2>
            <ul className="mt-4 space-y-2.5">
              {related.tutorials.map((tutorial) => (
                <li key={tutorial.slug}>
                  <Link
                    href={`/tutorials/${tutorial.slug}`}
                    className="group flex items-start gap-2.5 text-sm text-foreground hover:text-brand-700"
                  >
                    <GraduationCap className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                    <span>
                      <span className="font-medium underline-offset-4 group-hover:underline">{tutorial.title}</span>
                      <span className="text-body mt-0.5 block text-xs leading-relaxed">{tutorial.excerpt}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12">
          <RelatedPatterns products={related.products} />
        </div>

        {related.articles.length > 0 && (
          <section aria-labelledby="related-articles" className="mt-12 border-t border-border pt-8">
            <h2 id="related-articles" className="heading-sub">
              More on this
            </h2>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2">
              {related.articles.map((sibling) => (
                <li key={sibling.slug}>
                  <ArticleCardLink article={sibling} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-12 border-t border-border pt-6">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 underline-offset-4 hover:underline"
          >
            All articles
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </p>
      </article>
    </>
  );
}
