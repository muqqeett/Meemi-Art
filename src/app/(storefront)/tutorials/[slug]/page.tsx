import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, Newspaper } from "lucide-react";

import { Breadcrumbs } from "@/components/brand/breadcrumbs";
import { ContentBlocks } from "@/components/content/content-blocks";
import { RelatedPatterns } from "@/components/content/related-patterns";
import { TutorialCardLink } from "@/components/content/tutorial-card";
import { TutorialMaterials, TutorialSteps } from "@/components/content/tutorial-steps";
import { blocksToPlainText, headingId } from "@/lib/content/blocks";
import { resourcePath } from "@/lib/content/resources";
import { learnMetadata } from "@/lib/content/seo";
import { entityIds, siteConfig } from "@/lib/config";
import { safeJsonLd } from "@/lib/json-ld";
import {
  TUTORIAL_DIFFICULTY_LABELS,
  getPublishedTutorial,
  getTutorialRelations,
  tutorialIsoDuration,
  tutorialTimeLabel,
} from "@/lib/queries/tutorials";

/**
 * One tutorial.
 *
 * A draft returns a 404 — the same answer as a slug that never existed — so an
 * unpublished tutorial cannot be read by guessing its URL, and nothing links
 * it, lists it or puts it in the sitemap.
 *
 * The structured data is `HowTo`, which is what this page actually is: the
 * steps in it are the steps on the page, in the same order. No author person,
 * no rating, no invented date — the publisher is the shop, which is true.
 */
export async function generateMetadata({ params }: PageProps<"/tutorials/[slug]">) {
  const { slug } = await params;
  const tutorial = await getPublishedTutorial(slug);
  if (!tutorial) return { title: "Tutorial not found", robots: { index: false, follow: false } };

  return learnMetadata({
    title: tutorial.seoTitle ?? tutorial.title,
    description: tutorial.seoDescription ?? tutorial.excerpt,
    path: `/tutorials/${tutorial.slug}`,
    type: "article",
    image: tutorial.coverImageUrl
      ? { url: tutorial.coverImageUrl, alt: tutorial.coverImageAlt ?? tutorial.title }
      : null,
    publishedTime: tutorial.publishedAt.toISOString(),
    modifiedTime: tutorial.updatedAt.toISOString(),
    canonicalOverride: tutorial.canonicalUrl,
  });
}

export default async function TutorialPage({ params }: PageProps<"/tutorials/[slug]">) {
  const { slug } = await params;
  const tutorial = await getPublishedTutorial(slug);
  if (!tutorial) notFound();

  const related = await getTutorialRelations(tutorial);
  const url = `${siteConfig.url}/tutorials/${tutorial.slug}`;
  const time = tutorialTimeLabel(tutorial.minutesMin, tutorial.minutesMax);
  const duration = tutorialIsoDuration(tutorial.minutesMax);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": `${url}#howto`,
    url,
    name: tutorial.title,
    description: tutorial.excerpt,
    datePublished: tutorial.publishedAt.toISOString(),
    dateModified: tutorial.updatedAt.toISOString(),
    inLanguage: "en",
    isAccessibleForFree: true,
    publisher: { "@id": entityIds.organization },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(duration ? { totalTime: duration } : {}),
    ...(tutorial.coverImageUrl ? { image: [tutorial.coverImageUrl] } : {}),
    // The steps on the page, in the order they are on the page.
    step: tutorial.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: blocksToPlainText(step.blocks).slice(0, 1200),
      url: `${url}#${headingId(step.title)}`,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <article className="container-page max-w-3xl py-10 lg:py-14">
        <Breadcrumbs
          items={[
            { label: "Learn", href: "/learn" },
            { label: "Tutorials", href: "/tutorials" },
            { label: tutorial.title },
          ]}
        />

        <header className="mt-6 mb-8 border-b border-border pb-8">
          {tutorial.topic && (
            <Link href={`/tutorials?topic=${tutorial.topic.slug}`} className="label-caps text-brand-600 hover:underline">
              {tutorial.topic.name}
            </Link>
          )}
          <h1 className="heading-section mt-2">{tutorial.title}</h1>
          <p className="text-body mt-4 text-base leading-relaxed">{tutorial.excerpt}</p>
          <p className="text-body mt-5 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-foreground">{siteConfig.name}</span>
            <span aria-hidden className="opacity-40">·</span>
            <span>{TUTORIAL_DIFFICULTY_LABELS[tutorial.difficulty]}</span>
            {time && (
              <>
                <span aria-hidden className="opacity-40">·</span>
                <span>{time}</span>
              </>
            )}
            <span aria-hidden className="opacity-40">·</span>
            <time dateTime={tutorial.publishedAt.toISOString()}>
              {tutorial.publishedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </time>
          </p>
        </header>

        {tutorial.coverImageUrl && (
          <figure className="mb-10 overflow-hidden rounded-sm border border-border bg-surface-alt">
            <Image
              src={tutorial.coverImageUrl}
              alt={tutorial.coverImageAlt ?? ""}
              width={1200}
              height={675}
              sizes="(min-width: 768px) 48rem, 100vw"
              className="h-auto w-full object-cover"
              priority
            />
          </figure>
        )}

        <ContentBlocks blocks={tutorial.intro} />

        {tutorial.materials.length > 0 && (
          <div className="mt-8">
            <TutorialMaterials materials={tutorial.materials} />
          </div>
        )}

        {tutorial.steps.length > 2 && (
          <nav aria-label="The steps" className="mt-10 rounded-sm border border-border bg-surface-alt/60 px-5 py-4">
            <p className="label-caps text-muted-foreground">The steps</p>
            <ol className="text-body mt-3 list-decimal space-y-1.5 pl-5 text-sm">
              {tutorial.steps.map((step) => (
                <li key={step.title}>
                  <Link
                    href={`#${headingId(step.title)}`}
                    className="text-foreground underline-offset-4 hover:text-brand-600 hover:underline"
                  >
                    {step.title}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="mt-12">
          <TutorialSteps steps={tutorial.steps} />
        </div>

        {tutorial.outro.length > 0 && (
          <div className="mt-12 border-t border-border pt-8">
            <ContentBlocks blocks={tutorial.outro} />
          </div>
        )}

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

        {related.articles.length > 0 && (
          <section aria-labelledby="related-articles" className="mt-12 border-t border-border pt-8">
            <h2 id="related-articles" className="heading-sub">
              The wider explanation
            </h2>
            <ul className="mt-4 space-y-2.5">
              {related.articles.map((article) => (
                <li key={article.slug}>
                  <Link
                    href={`/blog/${article.slug}`}
                    className="group flex items-start gap-2.5 text-sm text-foreground hover:text-brand-700"
                  >
                    <Newspaper className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                    <span>
                      <span className="font-medium underline-offset-4 group-hover:underline">{article.title}</span>
                      <span className="text-body mt-0.5 block text-xs leading-relaxed">{article.excerpt}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12">
          <RelatedPatterns products={related.products} heading="Patterns that use this" />
        </div>

        {related.tutorials.length > 0 && (
          <section aria-labelledby="related-tutorials" className="mt-12 border-t border-border pt-8">
            <h2 id="related-tutorials" className="heading-sub">
              Next skill
            </h2>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2">
              {related.tutorials.map((sibling) => (
                <li key={sibling.slug}>
                  <TutorialCardLink tutorial={sibling} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-12 border-t border-border pt-6">
          <Link
            href="/tutorials"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 underline-offset-4 hover:underline"
          >
            All tutorials
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </p>
      </article>
    </>
  );
}
