"use client";

import { EMPTY_TUTORIAL, TutorialEditor } from "@/components/admin/tutorial-editor";
import { createTutorial } from "@/lib/actions/admin/tutorials";

/**
 * The create form.
 *
 * A thin client boundary: the editor is shared with editing, and the only
 * difference is which action it calls. The action does the validating.
 */
export function NewTutorialForm({
  topics,
  products,
}: {
  topics: { id: string; name: string }[];
  products: { id: string; name: string }[];
}) {
  return (
    <TutorialEditor
      initial={EMPTY_TUTORIAL}
      topics={topics}
      products={products}
      onSubmit={(values) => createTutorial(values)}
      submitLabel="Save draft"
    />
  );
}
