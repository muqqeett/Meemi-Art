"use client";

import { TutorialEditor, type TutorialFormValues } from "@/components/admin/tutorial-editor";
import { updateTutorial } from "@/lib/actions/admin/tutorials";

/** The edit form — the same editor, bound to an existing tutorial's id. */
export function EditTutorialForm({
  id,
  initial,
  topics,
  products,
}: {
  id: string;
  initial: TutorialFormValues;
  topics: { id: string; name: string }[];
  products: { id: string; name: string }[];
}) {
  return (
    <TutorialEditor
      initial={initial}
      topics={topics}
      products={products}
      onSubmit={(values) => updateTutorial(id, values)}
      submitLabel="Save changes"
    />
  );
}
