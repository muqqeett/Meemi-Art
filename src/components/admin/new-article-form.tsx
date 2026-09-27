"use client";

import { ArticleEditor, EMPTY_ARTICLE } from "@/components/admin/article-editor";
import { createArticle } from "@/lib/actions/admin/articles";

/**
 * The create form.
 *
 * A thin client boundary: the editor is shared with editing, and the only
 * difference is which action it calls. The action does the validating.
 */
export function NewArticleForm({
  topics,
  products,
}: {
  topics: { id: string; name: string }[];
  products: { id: string; name: string }[];
}) {
  return (
    <ArticleEditor
      initial={EMPTY_ARTICLE}
      topics={topics}
      products={products}
      onSubmit={(values) => createArticle(values)}
      submitLabel="Save draft"
    />
  );
}
