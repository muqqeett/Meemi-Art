import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, GraduationCap } from "lucide-react";

import { ArticleCardLink } from "@/components/content/article-card";
import { Breadcrumbs } from "@/components/brand/breadcrumbs";
import {
  PlumColumn,
  PlumGround,
  PlumLinkList,
  PlumSectionHead,
  PlumToc,
} from "@/components/content/plum";
import { plumButtonClass } from "@/components/ui/plum-button";
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

      {/*
        Article — Plum Studio "Article" (27:2732): a 720px reading column and a
        sticky "On this page" card beside it from lg, a plum eyebrow, a 52px
        Bricolage title and a cover with a 20px radius. Related articles close
        the page on the subtle band ("Keep learning").

        The design's "Free cheat sheet" card in the sidebar is not drawn: it is
        an email-capture download, and this shop has no such flow.

        The contents card comes before the body in the source, so on a phone it
        sits between the cover and the text exactly as it did; from lg it is
        moved into the second column by grid placement rather than rendered
        twice.
      */}
      <PlumGround>
        <PlumColumn className="pt-6 pb-16 lg:pt-8">
          <article className="grid grid-cols-[minmax(0,1fr)] gap-x-16 gap-y-5 lg:grid-cols-[minmax(0,720px)_minmax(0,1fr)]">
            <header className="flex flex-col items-start gap-5 lg:col-start-1">
              <Breadcrumbs
                variant="plum"
                items={[
                  { label: "Learn", href: "/learn" },
                  { label: "Articles", href: "/blog" },
                  { label: article.title },
                ]}
              />
              {article.topic && (
                <Link
                  href={`/blog/topic/${article.topic.slug}`}
                  className="pl-eyebrow pl-focus rounded-sm hover:underline"
                >
                  {article.topic.name}
                </Link>
              )}
              <h1 className="pl-display pl-h1">{article.title}</h1>
              <p className="flex flex-wrap items-center gap-2 text-sm leading-[22px] text-pl-muted">
                <span className="font-bold text-pl-text">{siteConfig.name}</span>
                <span aria-hidden>·</span>
                <time dateTime={article.publishedAt.toISOString()}>
                  {article.publishedAt.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <span aria-hidden>·</span>
                <span>{article.readingMinutes} min read</span>
              </p>
            </header>

            {article.coverImageUrl && (
              <figure className="overflow-hidden rounded-[20px] bg-pl-tint-crochet lg:col-start-1">
                <Image
                  src={article.coverImageUrl}
                  alt={article.coverImageAlt ?? ""}
                  width={1200}
                  height={675}
                  sizes="(min-width: 1024px) 45rem, 100vw"
                  className="h-auto w-full object-cover"
                  priority
                />
              </figure>
            )}

            {sections.length > 2 && (
              <div className="lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-start">
                <PlumToc
                  label="On this page"
                  items={sections.map((section) => ({
                    key: section.id,
                    href: `#${section.id}`,
                    text: section.text,
                  }))}
                />
              </div>
            )}

            <div className="flex flex-col gap-12 lg:col-start-1">
              <div className="flex flex-col gap-5">
                <p className="pl-lead !text-pl-text">{article.excerpt}</p>
                <ContentBlocks blocks={article.body} />
              </div>

              {related.resources.length > 0 && (
                <PlumLinkList
                  id="related-resources"
                  title="Keep these to hand"
                  Icon={BookOpen}
                  items={related.resources.map((resource) => ({
                    key: resource.slug,
                    href: resourcePath(resource.slug),
                    title: resource.title,
                    blurb: resource.description,
                  }))}
                />
              )}

              {related.tutorials.length > 0 && (
                <PlumLinkList
                  id="related-tutorials"
                  title="Try it step by step"
                  Icon={GraduationCap}
                  items={related.tutorials.map((tutorial) => ({
                    key: tutorial.slug,
                    href: `/tutorials/${tutorial.slug}`,
                    title: tutorial.title,
                    blurb: tutorial.excerpt,
                  }))}
                />
              )}

              <RelatedPatterns products={related.products} />

              <p>
                <Link href="/blog" className={plumButtonClass({ style: "secondary", size: "md" })}>
                  All articles
                  <ArrowRight className="size-5" aria-hidden />
                </Link>
              </p>
            </div>
          </article>
        </PlumColumn>

        {related.articles.length > 0 && (
          <section aria-labelledby="related-articles" className="bg-pl-subtle">
            <PlumColumn className="py-12">
              <PlumSectionHead id="related-articles" title="More on this" />
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.articles.map((sibling) => (
                  <li key={sibling.slug}>
                    <ArticleCardLink article={sibling} />
                  </li>
                ))}
              </ul>
            </PlumColumn>
          </section>
        )}
      </PlumGround>
    </>
  );
}
