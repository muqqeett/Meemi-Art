import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EditTutorialForm } from "@/components/admin/edit-tutorial-form";
import { ButtonLink } from "@/components/ui/button-link";
import { listLinkableProducts, listTopics } from "@/lib/queries/admin-articles";
import { getAdminTutorial } from "@/lib/queries/admin-tutorials";
import { TUTORIAL_PUBLISH_REQUIREMENTS } from "@/lib/validations/content";

export const metadata: Metadata = { title: "Edit tutorial" };

export default async function EditTutorialPage({ params }: PageProps<"/admin/content/tutorials/[id]/edit">) {
  const { id } = await params;
  const [tutorial, topics, products] = await Promise.all([getAdminTutorial(id), listTopics(), listLinkableProducts()]);
  if (!tutorial) notFound();

  const ready =
    tutorial.words >= TUTORIAL_PUBLISH_REQUIREMENTS.minWords &&
    tutorial.stepCount >= TUTORIAL_PUBLISH_REQUIREMENTS.minSteps;

  return (
    <div className="max-w-3xl">
      <AdminPageHeader
        eyebrow={tutorial.status === "PUBLISHED" ? "Published tutorial" : "Draft"}
        title={tutorial.title}
        description={
          tutorial.status === "PUBLISHED"
            ? "Changes go live as soon as they are saved."
            : `Not visible to readers. ${tutorial.words} words, ${tutorial.stepCount} steps — ${ready ? "ready to publish" : `publishing needs ${TUTORIAL_PUBLISH_REQUIREMENTS.minWords} words and ${TUTORIAL_PUBLISH_REQUIREMENTS.minSteps} steps`}.`
        }
        action={
          <span className="flex flex-wrap gap-2">
            <ButtonLink href={`/admin/content/tutorials/${tutorial.id}/preview`} variant="outline" size="sm">
              Preview
            </ButtonLink>
            <ButtonLink href="/admin/content/tutorials" variant="ghost" size="sm">
              All tutorials
            </ButtonLink>
          </span>
        }
      />

      <EditTutorialForm
        id={tutorial.id}
        initial={{
          title: tutorial.title,
          slug: tutorial.slug,
          excerpt: tutorial.excerpt,
          intro: tutorial.introText,
          steps: tutorial.stepsText,
          outro: tutorial.outroText,
          materials: tutorial.materials.join("\n"),
          difficulty: tutorial.difficulty,
          minutesMin: tutorial.minutesMin === null ? "" : String(tutorial.minutesMin),
          minutesMax: tutorial.minutesMax === null ? "" : String(tutorial.minutesMax),
          topicId: tutorial.topicId ?? "",
          coverImageUrl: tutorial.coverImageUrl ?? "",
          coverImageAlt: tutorial.coverImageAlt ?? "",
          seoTitle: tutorial.seoTitle ?? "",
          seoDescription: tutorial.seoDescription ?? "",
          canonicalUrl: tutorial.canonicalUrl ?? "",
          teaches: tutorial.teaches,
          tags: tutorial.tags.join(", "),
          productIds: tutorial.productIds,
        }}
        topics={topics.map((topic) => ({ id: topic.id, name: topic.name }))}
        products={products.map((product) => ({ id: product.id, name: product.name }))}
      />

      {tutorial.status === "PUBLISHED" && (
        <p className="text-body mt-6 text-xs">
          Live at{" "}
          <Link href={`/tutorials/${tutorial.slug}`} className="text-royal-600 underline underline-offset-4">
            /tutorials/{tutorial.slug}
          </Link>
          .
        </p>
      )}
    </div>
  );
}
