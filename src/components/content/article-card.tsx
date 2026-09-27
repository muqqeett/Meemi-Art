import Image from "next/image";
import Link from "next/link";

import type { ArticleCard } from "@/lib/queries/articles";

/**
 * One article in a list.
 *
 * The cover image is optional by design — an article without one is a real
 * article, not a broken card, so the layout holds without it rather than
 * reserving a grey rectangle. Dates are real publication dates and the
 * reading time is derived from the words actually in the piece.
 */
export function ArticleCardLink({ article }: { article: ArticleCard }) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-sm border border-border bg-card transition-colors duration-200 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      {article.coverImageUrl && (
        <span className="relative block aspect-[16/9] overflow-hidden bg-surface-alt">
          <Image
            src={article.coverImageUrl}
            alt={article.coverImageAlt ?? ""}
            fill
            sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </span>
      )}

      <span className="flex flex-1 flex-col px-5 py-5">
        {article.topic && <span className="label-caps text-brand-600">{article.topic.name}</span>}
        <span className="mt-2 block text-base leading-snug font-medium text-foreground group-hover:text-brand-700">
          {article.title}
        </span>
        <span className="text-body mt-2 block flex-1 text-sm leading-relaxed">{article.excerpt}</span>
        <span className="text-body mt-4 flex items-center gap-2 text-xs">
          <time dateTime={article.publishedAt.toISOString()}>
            {article.publishedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </time>
          <span aria-hidden className="opacity-40">·</span>
          <span>{article.readingMinutes} min read</span>
        </span>
      </span>
    </Link>
  );
}
