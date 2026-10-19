import Image from "next/image";
import Link from "next/link";
import { Download, Ban, Camera, PencilLine } from "lucide-react";

import { plumButtonClass } from "@/components/ui/plum-button";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { staggerStep } from "@/lib/motion";
import { formatBytes } from "@/lib/format-bytes";
import type { getDownloadsForUser } from "@/lib/queries/downloads";
import type { OwnReview } from "@/lib/queries/reviews";

export type DownloadEntry = Awaited<ReturnType<typeof getDownloadsForUser>>[number];

/**
 * The library list — Plum Studio "Library" (28:3320): one white card with a
 * divided row per file.
 *
 * Presentation only. The rows, the download links, the withdrawn state and the
 * review shortcuts are exactly what the downloads page rendered before; the
 * page still decides what the customer is entitled to, and `reviewable` is its
 * answer to "may they review this", passed in rather than asked for here.
 */
export function DownloadList({
  downloads,
  reviewable,
}: {
  downloads: DownloadEntry[];
  reviewable: Map<string, OwnReview | null>;
}) {
  return (
    <RevealGroup
      step={staggerStep.small}
      className="divide-y divide-pl-line overflow-hidden rounded-[20px] border border-pl-line bg-pl-surface shadow-pl-sm"
    >
      {downloads.map((entry) => (
        <RevealItem key={entry.accessId}>
          <article className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <Link
              href={`/products/${entry.productSlug}`}
              className="pl-focus relative size-16 shrink-0 overflow-hidden rounded-[12px] bg-pl-tint-crochet"
            >
              {entry.imageUrl && (
                <Image
                  src={entry.imageUrl}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-contain p-1.5"
                />
              )}
            </Link>

            <div className="min-w-0 flex-1">
              <h2 className="text-lg leading-6 font-bold tracking-[-0.005em] text-pl-text">
                <Link
                  href={`/products/${entry.productSlug}`}
                  className="pl-focus rounded-sm hover:underline"
                >
                  {entry.productName}
                </Link>
              </h2>
              <p className="mt-1 text-sm leading-[22px] text-pl-muted">
                Order {entry.orderNumber} ·{" "}
                {entry.purchasedAt.toLocaleDateString("en-US", { dateStyle: "medium" })}
                {entry.fileBytes > 0 && <> · {formatBytes(entry.fileBytes)}</>}
                {entry.fileVersion && <> · v{entry.fileVersion}</>}
              </p>
              {entry.downloadCount > 0 && entry.isActive && (
                <p className="mt-1 text-sm leading-[22px] text-pl-muted">
                  Downloaded {entry.downloadCount}{" "}
                  {entry.downloadCount === 1 ? "time" : "times"}
                </p>
              )}

              {/* A link to the product's own review panel rather than a
                  form inline: the review belongs beside the reviews, and
                  this keeps a list of files a list of files. */}
              {reviewable.has(entry.productId) && (
                <Link
                  href={`/products/${entry.productSlug}#reviews`}
                  className="pl-focus mt-2 inline-flex items-center gap-1.5 rounded-sm text-[13px] leading-[18px] font-bold text-plum-500 underline-offset-4 hover:underline"
                >
                  <PencilLine className="size-3.5" aria-hidden />
                  {reviewable.get(entry.productId)
                    ? "Edit Review"
                    : "Write a Review"}
                </Link>
              )}

              {/* Same purchase rule as the review link. A shortcut only:
                  the project form and the upload route check again. */}
              {reviewable.has(entry.productId) && (
                <Link
                  href={`/account/projects?product=${encodeURIComponent(entry.productId)}#share`}
                  className="pl-focus mt-2 ml-4 inline-flex items-center gap-1.5 rounded-sm text-[13px] leading-[18px] font-bold text-plum-500 underline-offset-4 hover:underline"
                >
                  <Camera className="size-3.5" aria-hidden />
                  Share your finished project
                </Link>
              )}
            </div>

            <div className="shrink-0">
              {entry.isActive ? (
                <a
                  href={`/api/download/${entry.productId}`}
                  className={plumButtonClass({ style: "secondary", size: "md" })}
                >
                  Download
                  <Download className="size-5" aria-hidden />
                </a>
              ) : (
                <span
                  className="font-figtree inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-pl-line px-5 text-[15px] leading-[18px] font-bold text-pl-muted"
                  title={entry.revokedReason ?? "Access withdrawn"}
                >
                  <Ban className="size-4" aria-hidden />
                  {entry.revokedReason ?? "Unavailable"}
                </span>
              )}
            </div>
          </article>
        </RevealItem>
      ))}
    </RevealGroup>
  );
}
