import Image from "next/image";
import Link from "next/link";

import {
  TUTORIAL_DIFFICULTY_LABELS,
  tutorialTimeLabel,
  type TutorialCard as TutorialCardData,
} from "@/lib/queries/tutorials";

/**
 * One tutorial in a list.
 *
 * Shows the two things that decide whether someone will start it now: how hard
 * it is and roughly how long it takes. Both come from stored values — a
 * tutorial without a time estimate simply does not claim one rather than
 * inventing a number.
 */
export function TutorialCardLink({ tutorial }: { tutorial: TutorialCardData }) {
  const time = tutorialTimeLabel(tutorial.minutesMin, tutorial.minutesMax);

  return (
    <Link
      href={`/tutorials/${tutorial.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-sm border border-border bg-card transition-colors duration-200 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      {tutorial.coverImageUrl && (
        <span className="relative block aspect-[16/9] overflow-hidden bg-surface-alt">
          <Image
            src={tutorial.coverImageUrl}
            alt={tutorial.coverImageAlt ?? ""}
            fill
            sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </span>
      )}

      <span className="flex flex-1 flex-col px-5 py-5">
        <span className="label-caps text-brand-600">
          {TUTORIAL_DIFFICULTY_LABELS[tutorial.difficulty]}
          {tutorial.topic && <span className="text-muted-foreground"> · {tutorial.topic.name}</span>}
        </span>
        <span className="mt-2 block text-base leading-snug font-medium text-foreground group-hover:text-brand-700">
          {tutorial.title}
        </span>
        <span className="text-body mt-2 block flex-1 text-sm leading-relaxed">{tutorial.excerpt}</span>
        <span className="text-body mt-4 flex flex-wrap items-center gap-2 text-xs">
          {time && (
            <>
              <span>{time}</span>
              <span aria-hidden className="opacity-40">·</span>
            </>
          )}
          <span>{tutorial.readingMinutes} min read</span>
        </span>
      </span>
    </Link>
  );
}
