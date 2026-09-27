import Link from "next/link";

import { Breadcrumbs } from "@/components/brand/breadcrumbs";
import { EmptyState } from "@/components/brand/empty-state";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { TutorialCardLink } from "@/components/content/tutorial-card";
import { learnMetadata } from "@/lib/content/seo";
import { listPublishedTutorials, listTopicsWithTutorials } from "@/lib/queries/tutorials";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = learnMetadata({
  title: "Crochet tutorials — step by step",
  // Deliberately describes the section rather than naming individual tutorials:
  // this page is indexable from the moment it exists, and a description that
  // lists pieces which are still drafts promises content that returns a 404.
  description:
    "Step-by-step crochet tutorials from Meemi Art. One skill at a time, with what you need, the steps in order, and what usually goes wrong.",
  path: "/tutorials",
});

/**
 * The tutorial index.
 *
 * Published tutorials only, through the same rule the tutorial page and the
 * sitemap use. The topic filter lists only topics that have something published
 * under them, so a filter can never lead to an empty page, and the filtered
 * URLs are deliberately absent from the sitemap for the same reason the shop's
 * facets are.
 */
export default async function TutorialsPage({ searchParams }: PageProps<"/tutorials">) {
  const raw = await searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const topicSlug = one(raw.topic);

  const [{ tutorials, page, pageCount, total }, topics] = await Promise.all([
    listPublishedTutorials({ page: Number(one(raw.page)) || 1, topicSlug }),
    listTopicsWithTutorials(),
  ]);

  const active = topics.find((topic) => topic.slug === topicSlug);

  const filter = (slug: string | undefined, label: string, count: number) => {
    const current = topicSlug === slug;
    const href = slug ? `/tutorials?topic=${slug}` : "/tutorials";
    return (
      <Link
        key={label}
        href={href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "inline-flex h-8 items-center rounded-md border px-3 text-[0.8125rem] transition-colors duration-150",
          current
            ? "border-brand-300 bg-brand-50 font-medium text-brand-700"
            : "border-border text-muted-foreground hover:border-brand-200 hover:text-foreground",
        )}
      >
        {label} ({count})
      </Link>
    );
  };

  return (
    <div className="container-page max-w-5xl py-10 lg:py-14">
      <Breadcrumbs items={[{ label: "Learn", href: "/learn" }, { label: "Tutorials" }]} />

      <header className="mt-6 mb-10 border-b border-border pb-8">
        <p className="label-caps text-brand-600">Tutorials</p>
        <h1 className="heading-section mt-2">{active ? active.name : "Crochet tutorials"}</h1>
        <p className="text-body mt-4 max-w-2xl text-base leading-relaxed">
          {active
            ? active.description
            : "One skill at a time, written as steps you can follow with the hook in your hand. Each tutorial says what it teaches, what you need, and what usually goes wrong — and links to the reference pages for anything it does not repeat."}
        </p>
      </header>

      {topics.length > 1 && (
        <nav aria-label="Filter by topic" className="mb-8 flex flex-wrap gap-1.5">
          {filter(undefined, "All", total)}
          {topics.map((topic) => filter(topic.slug, topic.name, topic.count))}
        </nav>
      )}

      {tutorials.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={GraduationCap}
          title="No tutorials yet"
          description="Tutorials are published here as they are finished. In the meantime, the reference pages cover abbreviations, hook sizes, yarn weights and pattern notation."
        />
      ) : (
        <>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tutorials.map((tutorial) => (
              <li key={tutorial.slug}>
                <TutorialCardLink tutorial={tutorial} />
              </li>
            ))}
          </ul>

          <PaginationNav
            page={page}
            pageCount={pageCount}
            baseQuery={topicSlug ? `topic=${topicSlug}` : ""}
            basePath="/tutorials"
          />
        </>
      )}

      <p className="text-body mt-12 border-t border-border pt-6 text-sm">
        Looking for the wider explanations rather than the steps?{" "}
        <Link href="/blog" className="font-medium text-brand-700 underline underline-offset-4">
          The articles
        </Link>{" "}
        cover how patterns work, and the{" "}
        <Link href="/learn" className="font-medium text-brand-700 underline underline-offset-4">
          reference pages
        </Link>{" "}
        are there to check mid-project.
      </p>
    </div>
  );
}
