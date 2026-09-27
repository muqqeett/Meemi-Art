import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ContentBlocks } from "@/components/content/content-blocks";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { publishArticleAction, unpublishArticleAction } from "@/lib/actions/admin/article-forms";
import { outline } from "@/lib/content/blocks";
import { getAdminArticle } from "@/lib/queries/admin-articles";
import { siteConfig } from "@/lib/config";
import { PUBLISH_REQUIREMENTS } from "@/lib/validations/content";

export const metadata: Metadata = { title: "Preview article", robots: { index: false, follow: false } };

/**
 * Preview a draft as a reader would see it.
 *
 * Inside the admin, behind `requireAdmin`, rather than as a public preview
 * URL with a token — a draft has exactly one audience until it is published,
 * and this keeps it that way. The body is rendered by the same component the
 * public page uses, so what is shown here is what will ship.
 */
export default async function PreviewArticlePage({ params }: PageProps<"/admin/content/articles/[id]/preview">) {
  const { id } = await params;
  const article = await getAdminArticle(id);
  if (!article) notFound();

  const sections = outline(article.blocks);
  const shortBy = PUBLISH_REQUIREMENTS.minWords - article.words;
  const blockers = [
    shortBy > 0 ? `${shortBy} more words needed` : null,
    sections.length < PUBLISH_REQUIREMENTS.minHeadings
      ? `${PUBLISH_REQUIREMENTS.minHeadings - sections.length} more section heading needed`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="max-w-3xl">
      <AdminPageHeader
        eyebrow={article.status === "PUBLISHED" ? "Published" : "Draft preview"}
        title="Preview"
        description={`${article.words} words · ${article.readingMinutes} min read · ${sections.length} ${sections.length === 1 ? "section" : "sections"}`}
        action={
          <span className="flex flex-wrap gap-2">
            <ButtonLink href={`/admin/content/articles/${article.id}/edit`} variant="outline" size="sm">
              Edit
            </ButtonLink>
            {article.status === "PUBLISHED" ? (
              <form action={unpublishArticleAction}>
                <input type="hidden" name="id" value={article.id} />
                <Button type="submit" variant="ghost" size="sm">
                  Unpublish
                </Button>
              </form>
            ) : (
              <form action={publishArticleAction}>
                <input type="hidden" name="id" value={article.id} />
                <Button type="submit" variant="brand" size="sm" disabled={blockers.length > 0}>
                  Publish
                </Button>
              </form>
            )}
          </span>
        }
      />

      {blockers.length > 0 && (
        <p role="status" className="mb-6 rounded-md border border-warning/25 bg-warning/8 px-4 py-3 text-sm text-foreground">
          Not ready to publish: {blockers.join(", ")}.
        </p>
      )}

      <div className="admin-card p-6 sm:p-8">
        <p className="label-caps flex items-center gap-1.5 text-muted-foreground">
          <Eye className="size-3.5" aria-hidden />
          As a reader sees it
        </p>

        <article className="mt-5">
          <h1 className="heading-section">{article.title}</h1>
          <p className="text-body mt-3 text-base leading-relaxed">{article.excerpt}</p>
          <p className="text-body mt-4 text-xs">
            {siteConfig.name} · {article.readingMinutes} min read
          </p>

          <div className="mt-8">
            <ContentBlocks blocks={article.blocks} />
          </div>
        </article>
      </div>

      <p className="text-body mt-6 text-xs">
        {article.status === "PUBLISHED" ? (
          <>
            Live at{" "}
            <Link href={`/blog/${article.slug}`} className="text-royal-600 underline underline-offset-4">
              /blog/{article.slug}
            </Link>
            .
          </>
        ) : (
          <>This draft is not reachable at /blog/{article.slug} — that URL returns a 404 until it is published.</>
        )}
      </p>
    </div>
  );
}
