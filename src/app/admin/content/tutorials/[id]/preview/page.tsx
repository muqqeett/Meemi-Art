import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ContentBlocks } from "@/components/content/content-blocks";
import { TutorialMaterials, TutorialSteps } from "@/components/content/tutorial-steps";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { publishTutorialAction, unpublishTutorialAction } from "@/lib/actions/admin/tutorial-forms";
import { getAdminTutorial } from "@/lib/queries/admin-tutorials";
import { siteConfig } from "@/lib/config";
import { TUTORIAL_PUBLISH_REQUIREMENTS } from "@/lib/validations/content";

export const metadata: Metadata = { title: "Preview tutorial", robots: { index: false, follow: false } };

/**
 * Preview a draft tutorial as a reader would see it.
 *
 * Inside the admin, behind `requireAdmin`, rather than as a public preview URL
 * with a token — a draft has exactly one audience until it is published. The
 * steps are rendered by the same components the public page uses, so what is
 * shown here is what will ship.
 */
export default async function PreviewTutorialPage({ params }: PageProps<"/admin/content/tutorials/[id]/preview">) {
  const { id } = await params;
  const tutorial = await getAdminTutorial(id);
  if (!tutorial) notFound();

  const shortBy = TUTORIAL_PUBLISH_REQUIREMENTS.minWords - tutorial.words;
  const stepsShort = TUTORIAL_PUBLISH_REQUIREMENTS.minSteps - tutorial.stepCount;
  const blockers = [
    shortBy > 0 ? `${shortBy} more words needed` : null,
    stepsShort > 0 ? `${stepsShort} more ${stepsShort === 1 ? "step" : "steps"} needed` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="max-w-3xl">
      <AdminPageHeader
        eyebrow={tutorial.status === "PUBLISHED" ? "Published" : "Draft preview"}
        title="Preview"
        description={`${tutorial.words} words · ${tutorial.readingMinutes} min read · ${tutorial.stepCount} ${tutorial.stepCount === 1 ? "step" : "steps"}`}
        action={
          <span className="flex flex-wrap gap-2">
            <ButtonLink href={`/admin/content/tutorials/${tutorial.id}/edit`} variant="outline" size="sm">
              Edit
            </ButtonLink>
            {tutorial.status === "PUBLISHED" ? (
              <form action={unpublishTutorialAction}>
                <input type="hidden" name="id" value={tutorial.id} />
                <Button type="submit" variant="ghost" size="sm">
                  Unpublish
                </Button>
              </form>
            ) : (
              <form action={publishTutorialAction}>
                <input type="hidden" name="id" value={tutorial.id} />
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
          <h1 className="heading-section">{tutorial.title}</h1>
          <p className="text-body mt-3 text-base leading-relaxed">{tutorial.excerpt}</p>
          <p className="text-body mt-4 text-xs">
            {siteConfig.name} · {tutorial.difficulty.charAt(0) + tutorial.difficulty.slice(1).toLowerCase()} ·{" "}
            {tutorial.readingMinutes} min read
          </p>

          <div className="mt-8">
            <ContentBlocks blocks={tutorial.intro} />
          </div>

          {tutorial.materials.length > 0 && (
            <div className="mt-8">
              <TutorialMaterials materials={tutorial.materials} />
            </div>
          )}

          <div className="mt-10">
            <TutorialSteps steps={tutorial.steps} />
          </div>

          {tutorial.outro.length > 0 && (
            <div className="mt-10 border-t border-border pt-8">
              <ContentBlocks blocks={tutorial.outro} />
            </div>
          )}
        </article>
      </div>

      <p className="text-body mt-6 text-xs">
        {tutorial.status === "PUBLISHED" ? (
          <>
            Live at{" "}
            <Link href={`/tutorials/${tutorial.slug}`} className="text-royal-600 underline underline-offset-4">
              /tutorials/{tutorial.slug}
            </Link>
            .
          </>
        ) : (
          <>This draft is not reachable at /tutorials/{tutorial.slug} — that URL returns a 404 until it is published.</>
        )}
      </p>
    </div>
  );
}
