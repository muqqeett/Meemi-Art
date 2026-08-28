import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Download, Ban, FileDown } from "lucide-react";

import { requireUser } from "@/lib/auth-guards";
import { getDownloadsForUser } from "@/lib/queries/downloads";
import { formatBytes } from "@/lib/format-bytes";
import { EmptyState } from "@/components/brand/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { staggerStep } from "@/lib/motion";

export const metadata: Metadata = {
  title: "Downloads",
  robots: { index: false, follow: false },
};

/**
 * The customer's purchased files.
 *
 * Every row here corresponds to a `DigitalAccess` grant, which only the
 * payment webhook can create — so anything listed has been paid for. A
 * refunded purchase is still listed, greyed out with its reason, rather than
 * vanishing: a customer who was refunded should be able to see that happened.
 *
 * The download button is a plain link to a route handler. It carries only the
 * product id; the authorisation is done server-side from the session.
 */
export default async function DownloadsPage() {
  const user = await requireUser("/account/downloads");
  const downloads = await getDownloadsForUser(user.id);

  return (
    <div>
      <header className="mb-8">
        <h1 className="heading-sub">Downloads</h1>
        <p className="text-body mt-1">
          Everything you have bought. Files stay here — come back to them any time.
        </p>
      </header>

      {downloads.length === 0 ? (
        <EmptyState
          icon={FileDown}
          title="No downloads yet"
          description="Once you buy something, your files appear here straight after payment."
          action={
            <ButtonLink href="/shop" variant="brand" size="pill">
              Browse the shop
            </ButtonLink>
          }
        />
      ) : (
        <RevealGroup step={staggerStep.small} className="space-y-3">
          {downloads.map((entry) => (
            <RevealItem key={entry.accessId}>
              <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center">
                <Link
                  href={`/products/${entry.productSlug}`}
                  className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface-alt"
                >
                  {entry.imageUrl && (
                    <Image
                      src={entry.imageUrl}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <h2 className="text-[0.9375rem] font-medium">
                    <Link
                      href={`/products/${entry.productSlug}`}
                      className="hover:text-brand-600"
                    >
                      {entry.productName}
                    </Link>
                  </h2>
                  <p className="text-body mt-1 text-xs">
                    Order {entry.orderNumber} ·{" "}
                    {entry.purchasedAt.toLocaleDateString("en-US", { dateStyle: "medium" })}
                    {entry.fileBytes > 0 && <> · {formatBytes(entry.fileBytes)}</>}
                    {entry.fileVersion && <> · v{entry.fileVersion}</>}
                  </p>
                  {entry.downloadCount > 0 && entry.isActive && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Downloaded {entry.downloadCount}{" "}
                      {entry.downloadCount === 1 ? "time" : "times"}
                    </p>
                  )}
                </div>

                <div className="shrink-0">
                  {entry.isActive ? (
                    <a
                      href={`/api/download/${entry.productId}`}
                      className="label-caps inline-flex h-11 items-center gap-2 rounded-xs bg-brand-700 px-5 text-white transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
                    >
                      <Download className="size-4" aria-hidden />
                      Download
                    </a>
                  ) : (
                    <span
                      className="label-caps inline-flex h-11 items-center gap-2 rounded-xs border border-border px-5 text-muted-foreground"
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
      )}
    </div>
  );
}
