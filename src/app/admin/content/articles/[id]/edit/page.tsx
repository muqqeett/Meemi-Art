import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EditArticleForm } from "@/components/admin/edit-article-form";
import { ButtonLink } from "@/components/ui/button-link";
import { getAdminArticle, listLinkableProducts, listTopics } from "@/lib/queries/admin-articles";
import { PUBLISH_REQUIREMENTS } from "@/lib/validations/content";

export const metadata: Metadata = { title: "Edit article" };

export default async function EditArticlePage({ params }: PageProps<"/admin/content/articles/[id]/edit">) {
  const { id } = await params;
  const [article, topics, products] = await Promise.all([getAdminArticle(id), listTopics(), listLinkableProducts()]);
  if (!article) notFound();

  const ready = article.words >= PUBLISH_REQUIREMENTS.minWords && article.sections >= PUBLISH_REQUIREMENTS.minHeadings;

  return (
    <div className="max-w-3xl">
      <AdminPageHeader
        eyebrow={article.status === "PUBLISHED" ? "Published article" : "Draft"}
        title={article.title}
        description={
          article.status === "PUBLISHED"
            ? "Changes go live as soon as they are saved."
            : `Not visible to readers. ${article.words} words, ${article.sections} sections — ${ready ? "ready to publish" : `publishing needs ${PUBLISH_REQUIREMENTS.minWords} words and ${PUBLISH_REQUIREMENTS.minHeadings} sections`}.`
        }
        action={
          <span className="flex flex-wrap gap-2">
            <ButtonLink href={`/admin/content/articles/${article.id}/preview`} variant="outline" size="sm">
              Preview
            </ButtonLink>
            <ButtonLink href="/admin/content/articles" variant="ghost" size="sm">
              All articles
            </ButtonLink>
          </span>
        }
      />

      <EditArticleForm
        id={article.id}
        initial={{
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt,
          body: article.bodyText,
          topicId: article.topicId ?? "",
          coverImageUrl: article.coverImageUrl ?? "",
          coverImageAlt: article.coverImageAlt ?? "",
          seoTitle: article.seoTitle ?? "",
          seoDescription: article.seoDescription ?? "",
          canonicalUrl: article.canonicalUrl ?? "",
          teaches: article.teaches,
          tags: article.tags.join(", "),
          productIds: article.productIds,
        }}
        topics={topics.map((topic) => ({ id: topic.id, name: topic.name }))}
        products={products.map((product) => ({ id: product.id, name: product.name }))}
      />

      {article.status === "PUBLISHED" && (
        <p className="text-body mt-6 text-xs">
          Live at{" "}
          <Link href={`/blog/${article.slug}`} className="text-royal-600 underline underline-offset-4">
            /blog/{article.slug}
          </Link>
          .
        </p>
      )}
    </div>
  );
}
