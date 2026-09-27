import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { NewTutorialForm } from "@/components/admin/new-tutorial-form";
import { listLinkableProducts, listTopics } from "@/lib/queries/admin-articles";

export const metadata: Metadata = { title: "New tutorial" };

/** A new tutorial always starts as a draft; publishing is a separate step. */
export default async function NewTutorialPage() {
  const [topics, products] = await Promise.all([listTopics(), listLinkableProducts()]);

  return (
    <div className="max-w-3xl">
      <AdminPageHeader
        eyebrow="Content"
        title="New tutorial"
        description="Saved as a draft. Nothing is visible to readers, search engines or the sitemap until you publish it."
      />
      <NewTutorialForm
        topics={topics.map((topic) => ({ id: topic.id, name: topic.name }))}
        products={products.map((product) => ({ id: product.id, name: product.name }))}
      />
    </div>
  );
}
