import Link from "next/link";
import { Star, Download } from "lucide-react";

import { PdpDescription } from "@/components/product/pdp/pdp-description";
import { PdpTabs } from "@/components/product/pdp/pdp-tabs";
import { formatMoney, discountPercent } from "@/lib/money";
import { formatBytes } from "@/lib/format-bytes";
import { formatLabel } from "@/lib/file-format";

type PdpInfoProps = {
  productName: string;
  brand: string;
  name: string;
  description: string;
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
};

/**
 * The product information column — Figma "Details container" (8211:1462).
 *
 *   column   537 wide, 40 between blocks
 *   title    Recoleta SemiBold 40/48 — a serif, so `font-display` (Fraunces)
 *   meta     stars · "N reviews" · rule · spec, 18/28 Medium
 *   price    32/40 SemiBold
 *   rules    hairlines above and below the option row
 *   buy row  pills, primary takes the remaining width
 *   below    wishlist and a guarantee line, 40 apart
 *   tabs     segmented control on a `#eaecf0` track
 *
 * The design's green (#1a432e / #39b856) is the template's brand, not this
 * one; every colour here comes from the existing `pdp-*` and `brand-*` tokens
 * so the page sits beside the new header and the auth screens rather than
 * beside a vitamin shop.
 *
 * Three of the design's controls describe a physical product and have been
 * adapted rather than copied:
 *
 *   flavour swatches  → the file facts. A file has no "Orange", and a swatch
 *                       row with nothing behind it is a control that lies.
 *   volume dropdown   → dropped. There is one file per product;
 *                       `DigitalAsset.productId` is unique.
 *   quantity stepper  → dropped. Buying two copies of the same download is not
 *                       a thing a shopper means to do, and the cart already
 *                       treats this as quantity 1.
 *
 * "30 days money back guarantee" is likewise not reproduced: the real policy is
 * 14 days and conditional (see /refunds), and printing a guarantee the shop
 * does not offer would be a false promise on the page where money is asked for.
 */
export function PdpInfo({
  brand,
  name,
  description,
  priceCents,
  compareAtCents,
  ratingAvg,
  reviewCount,
  soldCount,
  asset,
}: PdpInfoProps) {
  const off = discountPercent(priceCents, compareAtCents);

  /**
   * Only what the database actually holds.
   *
   * `DigitalAsset` records a filename, a MIME type, a byte count and a version
   * string — so those are the four facts that can be stated. There is no skill
   * level, no materials list and no tools list anywhere in the schema, so none
   * is shown.
   */
  const facts = [
    asset && `${formatLabel(asset.contentType, asset.filename)} file${
      asset.bytes > 0 ? ` · ${formatBytes(asset.bytes)}` : ""
    }`,
    "Instant download the moment payment clears",
    "Yours to re-download, as often as you like",
    "Secure, expiring download link",
  ].filter(Boolean) as string[];

  const format = asset ? formatLabel(asset.contentType, asset.filename) : null;

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      {/* ── Identity ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5">
        {/* The badge was a grey pill — the loudest shape in the column and the
            first thing read, for the least important fact. It is now a rule
            with a line of micro-type on it: the same words, given the weight
            they deserve. */}
        <span className="inline-flex w-fit items-center gap-2 border-b border-brand-400/45 pb-2 text-[0.6875rem] leading-none font-semibold tracking-[0.16em] text-brand-600 uppercase">
          <Download className="size-3 shrink-0" aria-hidden />
          Digital product
        </span>

        <div className="flex flex-col gap-3">
          <p className="text-[0.6875rem] leading-none font-semibold tracking-[0.22em] text-pdp-label uppercase">
            {brand}
          </p>
          {/* The headline. It carried 2.25rem against a 2rem price, so the two
              competed and neither led. At 3.5rem on a wide screen the title is
              unambiguously first and the column finally has a top. Tighter
              tracking and leading as it grows, the way display type wants. */}
          <h1 className="font-display text-[2.125rem] leading-[1.05] font-semibold tracking-[-0.03em] text-balance text-pdp-title sm:text-[2.75rem] lg:text-[3.25rem] wide:text-[3.5rem]">
            {name}
          </h1>
        </div>

        {/* Stars · review count · divider · spec — the design's meta row. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {reviewCount > 0 ? (
            <span className="flex items-center gap-2.5">
              <span className="flex gap-0.5" aria-hidden>
                {[1, 2, 3, 4, 5].map((step) => (
                  <Star
                    key={step}
                    className={
                      step <= Math.round(ratingAvg)
                        ? "size-[15px] shrink-0 fill-pdp-star text-pdp-star"
                        : "size-[15px] shrink-0 fill-pdp-track text-pdp-track"
                    }
                  />
                ))}
              </span>
              <a
                href="#reviews"
                className="text-[0.6875rem] font-semibold tracking-[0.14em] text-pdp-title uppercase underline-offset-4 hover:underline"
              >
                {reviewCount.toLocaleString("en-US")}{" "}
                {reviewCount === 1 ? "review" : "reviews"}
              </a>
              <span className="sr-only">Rated {ratingAvg.toFixed(1)} out of 5</span>
            </span>
          ) : (
            <span className="text-[0.6875rem] font-semibold tracking-[0.14em] text-pdp-meta uppercase">No reviews yet</span>
          )}

          {format && (
            <>
              <span aria-hidden className="text-[0.6875rem] text-pdp-label">/</span>
              <span className="text-[0.6875rem] font-semibold tracking-[0.14em] text-pdp-meta uppercase">{format}</span>
            </>
          )}

          {soldCount > 0 && (
            <>
              <span aria-hidden className="text-[0.6875rem] text-pdp-label">/</span>
              <span className="text-[0.6875rem] font-semibold tracking-[0.14em] text-pdp-meta uppercase">
                {soldCount.toLocaleString("en-US")} sold
              </span>
            </>
          )}
        </div>

        {/* Price. Sits on its own line under the meta row, as drawn. */}
        <p className="flex flex-wrap items-baseline gap-3">
          <span className="font-display text-[2.5rem] leading-[1.1] font-semibold tracking-[-0.02em] text-pdp-price lg:text-[2.75rem]">
            {formatMoney(priceCents)}
          </span>
          {compareAtCents && off !== null && (
            <>
              <span className="text-lg font-medium text-pdp-body line-through">
                {formatMoney(compareAtCents)}
              </span>
              <span className="rounded-full bg-brand-700 px-2.5 py-1 text-xs font-semibold text-white">
                −{off}%
              </span>
            </>
          )}
        </p>

        <hr className="border-pdp-hairline" />

        <PdpDescription text={description} />
      </div>

      {/* ── What arrives ─────────────────────────────────────────────────── */}
      <div className="-mx-5 flex flex-col gap-5 rounded-[3px] bg-pdp-field/55 px-5 py-7 sm:-mx-6 sm:px-6">
        <p className="text-[0.6875rem] leading-none font-semibold tracking-[0.22em] text-pdp-label uppercase">
          What you get
        </p>

        {/* Numbered rather than ticked. Each line is still exactly one fact the
            schema holds — the list is unchanged — but a set of identical check
            marks gave every row the same weight and read as a feature grid.
            An index column makes it a contents page: the eye counts, and the
            hairline between rows does the separating that the ticks were
            standing in for. The numerals are decorative, so they are hidden
            from assistive tech and the list stays a plain list. */}
        <ul className="flex flex-col">
          {facts.map((fact, index) => (
            <li
              key={fact}
              className="flex items-baseline gap-5 border-b border-pdp-hairline/70 py-3 last:border-0 last:pb-0 first:pt-0"
            >
              <span
                aria-hidden
                className="w-6 shrink-0 font-display text-[0.8125rem] leading-none font-semibold text-brand-400 tabular-nums"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-[0.9375rem] leading-[1.6] text-pdp-body">{fact}</span>
            </li>
          ))}
        </ul>

        {asset && (
          <p className="text-sm break-all text-pdp-meta">
            {asset.filename}
            {asset.version && (
              <span className="text-pdp-subtle"> · version {asset.version}</span>
            )}
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
                  className="font-medium text-pdp-title underline underline-offset-2"
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
                <dt className="text-pdp-meta">Format</dt>
                <dd className="font-medium text-pdp-title">
                  {formatLabel(asset.contentType, asset.filename)}
                </dd>
                {asset.bytes > 0 && (
                  <>
                    <dt className="text-pdp-meta">Size</dt>
                    <dd className="font-medium text-pdp-title">
                      {formatBytes(asset.bytes)}
                    </dd>
                  </>
                )}
                {asset.version && (
                  <>
                    <dt className="text-pdp-meta">Version</dt>
                    <dd className="font-medium text-pdp-title">{asset.version}</dd>
                  </>
                )}
                <dt className="text-pdp-meta">Filename</dt>
                <dd className="font-medium break-all text-pdp-title">
                  {asset.filename}
                </dd>
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
                  className="font-medium text-pdp-title underline underline-offset-2"
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
