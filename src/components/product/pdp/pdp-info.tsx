import Link from "next/link";
import { Star, Download, RefreshCw, ShieldCheck, FileText } from "lucide-react";

import { PdpDescription } from "@/components/product/pdp/pdp-description";
import { PdpTabs } from "@/components/product/pdp/pdp-tabs";
import { formatMoney, discountPercent } from "@/lib/money";
import { formatBytes } from "@/lib/format-bytes";
import { formatLabel } from "@/lib/file-format";
import { PdpDifficulty } from "@/components/product/pdp/pdp-difficulty";
import { evaluatePublicDifficulty, type StoredDifficulty } from "@/lib/difficulty/engine";

type PdpInfoProps = {
  productName: string;
  brand: string;
  name: string;
  description: string;
  /** Shown in the caption line above the title ("Crochet Bags · PDF"). */
  categoryName?: string;
  priceCents: number;
  compareAtCents: number | null;
  ratingAvg: number;
  reviewCount: number;
  soldCount: number;
  asset: {
    contentType: string;
    bytes: number;
    version: string;
    filename: string;
  } | null;
  /** The stored difficulty inputs, when the product has them. */
  difficulty?: StoredDifficulty | null;
};

/**
 * The product information column — Plum Studio "Product / Info" (19:1361).
 *
 *   caption   13/18 Medium, muted — category · format
 *   title     Bricolage ExtraBold 42/46, -3%
 *   meta      14/22 — ★ rating · N reviews
 *   price     Bricolage ExtraBold 38/42
 *   lead      16/26 muted
 *   trust     three rows, a plum glyph then a bold line and a 14/22 line
 *   details   a segmented tab control on an ink-100 pill track
 *
 * Every line is real. The design also draws a licence picker (Personal /
 * Small business, each with its own price), a "Mix any 3, save 20%" bundle
 * meter and a spec table with yarn, hook and finished size. The shop has no
 * licence tiers or bundle pricing to back the first two, and the product
 * record holds no yarn, hook or size fields for the third, so none of them is
 * drawn: a picker that selects nothing, a discount that is not applied and
 * measurements nobody wrote would all be false statements on the page where
 * money is asked for. What replaces them is what the schema does hold — the
 * file facts and, where the product has one, the project-difficulty block.
 *
 * "30 days money back guarantee" is likewise not reproduced: the real policy is
 * 14 days and conditional (see /refunds).
 */
export function PdpInfo({
  brand,
  name,
  description,
  categoryName,
  priceCents,
  compareAtCents,
  ratingAvg,
  reviewCount,
  soldCount,
  asset,
  difficulty = null,
}: PdpInfoProps) {
  const off = discountPercent(priceCents, compareAtCents);
  // Null unless the product has an enabled, valid rating — in which case the
  // column renders exactly as it did before difficulty existed.
  const difficultyResult = evaluatePublicDifficulty(difficulty);

  const format = asset ? formatLabel(asset.contentType, asset.filename) : null;
  const caption = [categoryName, format].filter(Boolean).join(" · ");

  /**
   * Only what the database actually holds, in the design's trust-row shape.
   * `DigitalAsset` records a filename, a MIME type, a byte count and a version.
   */
  const trust = [
    {
      Icon: Download,
      title: "Instant download",
      body: asset
        ? `${formatLabel(asset.contentType, asset.filename)} file${
            asset.bytes > 0 ? ` · ${formatBytes(asset.bytes)}` : ""
          }, yours the moment payment clears.`
        : "Yours the moment payment clears.",
    },
    {
      Icon: RefreshCw,
      title: "Download again any time",
      body: "The file stays in your account, to re-download as often as you like.",
    },
    {
      Icon: ShieldCheck,
      title: "Secure download link",
      body: "Each link is generated fresh and expires after a few minutes.",
    },
  ];

  return (
    <div className="font-figtree flex flex-col gap-6 lg:gap-8">
      {/* ── Identity ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <p className="text-[13px] leading-[18px] font-medium text-pl-muted">
          {caption || brand}
        </p>

        <h1 className="pl-display text-[34px] leading-[38px] tracking-[-0.03em] text-balance sm:text-[42px] sm:leading-[46px]">
          {name}
        </h1>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-[22px] text-pl-muted">
          {reviewCount > 0 ? (
            <span className="flex items-center gap-2">
              <span className="flex gap-0.5" aria-hidden>
                {[1, 2, 3, 4, 5].map((step) => (
                  <Star
                    key={step}
                    className={
                      step <= Math.round(ratingAvg)
                        ? "size-4 shrink-0 fill-plum-500 text-plum-500"
                        : "size-4 shrink-0 fill-transparent text-pl-line-strong"
                    }
                  />
                ))}
              </span>
              <span>{ratingAvg.toFixed(1)}</span>
              <a
                href="#reviews"
                className="pl-focus rounded-sm text-pl-text underline-offset-4 hover:underline"
              >
                {reviewCount.toLocaleString("en-US")}{" "}
                {reviewCount === 1 ? "review" : "reviews"}
              </a>
              <span className="sr-only">Rated {ratingAvg.toFixed(1)} out of 5</span>
            </span>
          ) : (
            <span>No reviews yet</span>
          )}

          {soldCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>{soldCount.toLocaleString("en-US")} sold</span>
            </>
          )}
        </div>

        <p className="flex flex-wrap items-baseline gap-3">
          <span className="pl-display text-[38px] leading-[42px] tracking-[-0.015em]">
            {formatMoney(priceCents)}
          </span>
          {compareAtCents && off !== null && (
            <>
              <span className="text-lg font-medium text-pl-muted line-through">
                {formatMoney(compareAtCents)}
              </span>
              <span className="rounded-full bg-plum-900 px-2.5 py-1 text-[13px] leading-4 font-bold text-pl-on-dark">
                −{off}%
              </span>
            </>
          )}
        </p>

        <PdpDescription text={description} />
      </div>

      {/* ── Project difficulty ───────────────────────────────────────────── */}
      {difficultyResult && <PdpDifficulty result={difficultyResult} />}

      {/* ── What arrives ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3.5 pt-2">
        <h2 className="sr-only">What you get</h2>
        <ul className="flex flex-col gap-3.5">
          {trust.map(({ Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <Icon className="size-7 shrink-0 text-plum-500" aria-hidden strokeWidth={1.75} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-base leading-[22px] font-bold tracking-[-0.005em] text-pl-text">
                  {title}
                </p>
                <p className="text-sm leading-[22px] text-pl-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        {asset && (
          <p className="flex items-start gap-2 text-[13px] leading-[18px] font-medium break-all text-pl-muted">
            <FileText className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              {asset.filename}
              {asset.version && <span> · version {asset.version}</span>}
            </span>
          </p>
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <PdpTabs
        tabs={[
          {
            id: "details",
            label: "Details",
            panel: (
              <p>
                A digital download — nothing is posted. As soon as your payment is
                confirmed the file appears in{" "}
                <Link
                  href="/account/downloads"
                  className="pl-focus font-bold text-pl-text underline underline-offset-2"
                >
                  My Downloads
                </Link>
                , and you can download it again whenever you need to. Links are
                generated fresh each time and expire after a few minutes.
              </p>
            ),
          },
          {
            id: "file",
            label: "The file",
            panel: asset ? (
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2">
                <dt className="text-pl-muted">Format</dt>
                <dd className="font-bold text-pl-text">
                  {formatLabel(asset.contentType, asset.filename)}
                </dd>
                {asset.bytes > 0 && (
                  <>
                    <dt className="text-pl-muted">Size</dt>
                    <dd className="font-bold text-pl-text">{formatBytes(asset.bytes)}</dd>
                  </>
                )}
                {asset.version && (
                  <>
                    <dt className="text-pl-muted">Version</dt>
                    <dd className="font-bold text-pl-text">{asset.version}</dd>
                  </>
                )}
                <dt className="text-pl-muted">Filename</dt>
                <dd className="font-bold break-all text-pl-text">{asset.filename}</dd>
              </dl>
            ) : (
              <p>File details are added when the download is attached.</p>
            ),
          },
          {
            id: "refunds",
            label: "Refunds",
            panel: (
              <p>
                Because the file is available the moment payment clears, digital
                purchases are not automatically refundable. We refund in full if the
                file is faulty, will not open in the format stated, or is materially
                different from its description — tell us within 14 days. The full
                terms are on the{" "}
                <Link
                  href="/refunds"
                  className="pl-focus font-bold text-pl-text underline underline-offset-2"
                >
                  refund policy
                </Link>{" "}
                page.
              </p>
            ),
          },
        ]}
      />
    </div>
  );
}
