import Image from "next/image";
import Link from "next/link";

import {
  TUTORIAL_DIFFICULTY_LABELS,
  tutorialTimeLabel,
  type TutorialCard as TutorialCardData,
} from "@/lib/queries/tutorials";

/**
 * One tutorial in a list — the same Plum Studio "Post card" as an article.
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
      className="pl-focus group font-figtree flex h-full flex-col gap-3 rounded-[20px]"
    >
      {tutorial.coverImageUrl && (
        <span className="relative block aspect-[1600/840] overflow-hidden rounded-[20px] bg-pl-tint-crochet">
          <Image
            src={tutorial.coverImageUrl}
            alt={tutorial.coverImageAlt ?? ""}
            fill
            sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </span>
      )}

      <span className="flex flex-1 flex-col gap-1.5">
        <span className="pl-eyebrow">
          {TUTORIAL_DIFFICULTY_LABELS[tutorial.difficulty]}
          {tutorial.topic && <span className="text-pl-muted"> · {tutorial.topic.name}</span>}
        </span>
        <span className="pl-h3 block group-hover:underline group-hover:underline-offset-4">
          {tutorial.title}
        </span>
        <span className="block flex-1 text-sm leading-[22px] text-pl-muted">{tutorial.excerpt}</span>
        <span className="flex flex-wrap items-center gap-2 text-[13px] leading-[18px] font-medium text-pl-muted">
          {time && (
            <>
              <span>{time}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span>{tutorial.readingMinutes} min read</span>
        </span>
      </span>
    </Link>
  );
}
