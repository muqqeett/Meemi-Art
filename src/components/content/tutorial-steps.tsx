import { ContentBlocks } from "@/components/content/content-blocks";
import { headingId, type TutorialStep } from "@/lib/content/blocks";

/**
 * The numbered steps of a tutorial — Plum Studio "Step" (27:2805).
 *
 * An ordered list, because the order is the instruction — a reader who loses
 * their place needs the number, and a screen reader should announce "3 of 8"
 * rather than reading eight headings in a row. Each step's heading carries the
 * same anchor id the contents list links to, so the two cannot drift.
 *
 * The number sits in a 36px plum-100 disc beside a 20px Bricolage title. The
 * step bodies are rendered by the same `ContentBlocks` the articles use, so a
 * callout, a table or a diagram looks identical wherever it appears.
 */
export function TutorialSteps({ steps }: { steps: TutorialStep[] }) {
  if (steps.length === 0) return null;

  return (
    <ol className="font-figtree space-y-8">
      {steps.map((step, index) => (
        <li key={`${step.title}-${index}`} className="flex gap-4">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-plum-100 text-base leading-[22px] font-bold tabular-nums text-plum-500"
          >
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={headingId(step.title)} className="pl-h3 scroll-mt-24 pt-1.5">
              <span className="sr-only">Step {index + 1}: </span>
              {step.title}
            </h2>
            <div className="mt-3">
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
      className="font-figtree rounded-[20px] bg-pl-subtle p-5"
    >
      <h2 id="tutorial-materials" className="pl-h3">
        What you need
      </h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base leading-[26px] text-pl-text marker:text-plum-500">
        {materials.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
