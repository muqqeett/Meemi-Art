"use client";

import { ArticleEditor, type ArticleFormValues } from "@/components/admin/article-editor";
import { updateArticle } from "@/lib/actions/admin/articles";

/** The edit form — the same editor, bound to an existing article's id. */
export function EditArticleForm({
  id,
  initial,
  topics,
  products,
}: {
  id: string;
  initial: ArticleFormValues;
  topics: { id: string; name: string }[];
  products: { id: string; name: string }[];
}) {
  return (
    <ArticleEditor
      initial={initial}
      topics={topics}
      products={products}
      onSubmit={(values) => updateArticle(id, values)}
      submitLabel="Save changes"
    />
  );
}
