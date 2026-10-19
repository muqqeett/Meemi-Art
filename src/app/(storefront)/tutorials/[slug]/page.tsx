import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, Newspaper } from "lucide-react";

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

      <PlumGround>
        <PlumColumn className="pt-6 pb-16 lg:pt-8">
          <article className="grid grid-cols-[minmax(0,1fr)] gap-x-16 gap-y-5 lg:grid-cols-[minmax(0,720px)_minmax(0,1fr)]">
            <header className="flex flex-col items-start gap-5 lg:col-start-1">
              <Breadcrumbs
                variant="plum"
                items={[
                  { label: "Learn", href: "/learn" },
                  { label: "Tutorials", href: "/tutorials" },
                  { label: tutorial.title },
                ]}
              />
              {tutorial.topic && (
                <Link
                  href={`/tutorials?topic=${tutorial.topic.slug}`}
                  className="pl-eyebrow pl-focus rounded-sm hover:underline"
                >
                  {tutorial.topic.name}
                </Link>
              )}
              <h1 className="pl-display pl-h1">{tutorial.title}</h1>
              <p className="flex flex-wrap items-center gap-2 text-sm leading-[22px] text-pl-muted">
                <span className="font-bold text-pl-text">{siteConfig.name}</span>
                <span aria-hidden>·</span>
                <span>{TUTORIAL_DIFFICULTY_LABELS[tutorial.difficulty]}</span>
                {time && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{time}</span>
                  </>
                )}
                <span aria-hidden>·</span>
                <time dateTime={tutorial.publishedAt.toISOString()}>
                  {tutorial.publishedAt.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              </p>
            </header>

            {tutorial.coverImageUrl && (
              <figure className="overflow-hidden rounded-[20px] bg-pl-tint-crochet lg:col-start-1">
                <Image
                  src={tutorial.coverImageUrl}
                  alt={tutorial.coverImageAlt ?? ""}
                  width={1200}
                  height={675}
                  sizes="(min-width: 1024px) 45rem, 100vw"
                  className="h-auto w-full object-cover"
                  priority
                />
              </figure>
            )}

            {tutorial.steps.length > 2 && (
              <div className="lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-start">
                <PlumToc
                  label="The steps"
                  ordered
                  items={tutorial.steps.map((step) => ({
                    key: step.title,
                    href: `#${headingId(step.title)}`,
                    text: step.title,
                  }))}
                />
              </div>
            )}

            <div className="flex flex-col gap-12 lg:col-start-1">
              <div className="flex flex-col gap-8">
                <ContentBlocks blocks={tutorial.intro} />
                {tutorial.materials.length > 0 && (
                  <TutorialMaterials materials={tutorial.materials} />
                )}
              </div>

              <TutorialSteps steps={tutorial.steps} />

              {tutorial.outro.length > 0 && (
                <div className="border-t border-pl-line pt-8">
                  <ContentBlocks blocks={tutorial.outro} />
                </div>
              )}

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

              {related.articles.length > 0 && (
                <PlumLinkList
                  id="related-articles"
                  title="The wider explanation"
                  Icon={Newspaper}
                  items={related.articles.map((article) => ({
                    key: article.slug,
                    href: `/blog/${article.slug}`,
                    title: article.title,
                    blurb: article.excerpt,
                  }))}
                />
              )}

              <RelatedPatterns products={related.products} heading="Patterns that use this" />

              <p>
                <Link href="/tutorials" className={plumButtonClass({ style: "secondary", size: "md" })}>
                  All tutorials
                  <ArrowRight className="size-5" aria-hidden />
                </Link>
              </p>
            </div>
          </article>
        </PlumColumn>

        {related.tutorials.length > 0 && (
          <section aria-labelledby="related-tutorials" className="bg-pl-subtle">
            <PlumColumn className="py-12">
              <PlumSectionHead id="related-tutorials" title="Next skill" />
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.tutorials.map((sibling) => (
                  <li key={sibling.slug}>
                    <TutorialCardLink tutorial={sibling} />
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
