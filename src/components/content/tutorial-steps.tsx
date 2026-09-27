import { ContentBlocks } from "@/components/content/content-blocks";
import { headingId, type TutorialStep } from "@/lib/content/blocks";

/**
 * The numbered steps of a tutorial.
 *
 * An ordered list, because the order is the instruction — a reader who loses
 * their place needs the number, and a screen reader should announce "3 of 8"
 * rather than reading eight headings in a row. Each step's heading carries the
 * same anchor id the contents list links to, so the two cannot drift.
 *
 * The step bodies are rendered by the same `ContentBlocks` the articles use, so
 * a callout, a table or a diagram looks identical wherever it appears.
 */
export function TutorialSteps({ steps }: { steps: TutorialStep[] }) {
  if (steps.length === 0) return null;

  return (
    <ol className="space-y-10">
      {steps.map((step, index) => (
        <li key={`${step.title}-${index}`} className="grid gap-4 sm:grid-cols-[2.5rem_1fr] sm:gap-5">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full border border-brand-200 bg-brand-50/70 text-sm font-semibold tabular-nums text-brand-700"
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <h2 id={headingId(step.title)} className="heading-sub scroll-mt-24">
              <span className="sr-only">Step {index + 1}: </span>
              {step.title}
            </h2>
            <div className="mt-4">
              <ContentBlocks blocks={step.blocks} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** What to have to hand before starting. Rendered only when there is something. */
export function TutorialMaterials({ materials }: { materials: string[] }) {
  if (materials.length === 0) return null;

  return (
    <section
      aria-labelledby="tutorial-materials"
      className="rounded-sm border border-border bg-surface-alt/60 px-5 py-5"
    >
      <h2 id="tutorial-materials" className="text-base font-semibold text-foreground">
        What you need
      </h2>
      <ul className="text-body mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
        {materials.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
