import Image from "next/image";
import Link from "next/link";

import type { ArticleCard } from "@/lib/queries/articles";

/**
 * One article in a list — Plum Studio "Post card" (15:553).
 *
 * A 1.91:1 cover on a plum tint with a 20px radius, then a plum eyebrow, a
 * Bricolage title, a 14/22 excerpt and a caption line. The whole card is one
 * link, so its title is the accessible name.
 *
 * The cover image is optional by design — an article without one is a real
 * article, not a broken card. The design's illustrated covers are not drawn
 * for it: there is nothing to say about the piece in a placeholder picture, and
 * an empty tinted rectangle would only reserve space for one. Dates are real
 * publication dates and the reading time is derived from the words actually in
 * the piece.
 */
export function ArticleCardLink({ article }: { article: ArticleCard }) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="pl-focus group font-figtree flex h-full flex-col gap-3 rounded-[20px]"
    >
      {article.coverImageUrl && (
        <span className="relative block aspect-[1600/840] overflow-hidden rounded-[20px] bg-pl-tint-crochet">
          <Image
            src={article.coverImageUrl}
            alt={article.coverImageAlt ?? ""}
            fill
            sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </span>
      )}

      <span className="flex flex-1 flex-col gap-1.5">
        {article.topic && <span className="pl-eyebrow">{article.topic.name}</span>}
        <span className="pl-h3 block group-hover:underline group-hover:underline-offset-4">
          {article.title}
        </span>
        <span className="block flex-1 text-sm leading-[22px] text-pl-muted">{article.excerpt}</span>
        <span className="flex items-center gap-2 text-[13px] leading-[18px] font-medium text-pl-muted">
          <time dateTime={article.publishedAt.toISOString()}>
            {article.publishedAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          <span aria-hidden>·</span>
          <span>{article.readingMinutes} min read</span>
        </span>
      </span>
    </Link>
  );
}
