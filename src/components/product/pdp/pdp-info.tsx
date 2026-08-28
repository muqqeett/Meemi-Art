import Link from "next/link";
import {
  Star,
  Zap,
  Infinity as InfinityIcon,
  FileText,
  HardDrive,
  Lock,
  Download,
} from "lucide-react";

import { PdpDescription } from "@/components/product/pdp/pdp-description";
import { PdpBuyActions } from "@/components/product/pdp/pdp-buy-actions";
import { formatMoney, discountPercent } from "@/lib/money";
import { formatBytes } from "@/lib/format-bytes";
import { formatLabel } from "@/lib/file-format";

type PdpInfoProps = {
  productId: string;
  brand: string;
  name: string;
  description: string;
  priceCents: number;
  compareAtCents: number | null;
  ratingAvg: number;
  reviewCount: number;
  soldCount: number;
  isAvailable: boolean;
  asset: {
    contentType: string;
    bytes: number;
    version: string;
    filename: string;
  } | null;
};

/**
 * The product information column — Figma 79:666.
 *
 *   column   520 wide, 38 between the block and the "Delivery T&C" line
 *   brand    Clash Grotesk Medium 16/1.2, #8F8F8F, 0.16 tracking
 *   title    Clash Grotesk Semibold 36/1.2, #292929, -0.18 tracking
 *   was      Clash Grotesk Medium 18/1.2, #666, struck through
 *   price    Clash Grotesk Semibold 28/1.2, #141414
 *   meta     "N Sold" · star · rating, right-aligned on the same row
 *   rule     a hairline across the full 520
 *
 * Where the design has colour swatches and a size grid, this has the file
 * facts. A downloadable file has no size 12 and no "Royal Brown", and a
 * control offering them would be a control that lies; what a buyer of a
 * digital product actually needs to know is the format, the weight and the
 * edition. The rows keep the design's label-above-chips rhythm.
 *
 * "Delivery T&C" points at the refunds page for the same reason — nothing is
 * delivered, so the link goes where the real terms are.
 */
export function PdpInfo({
  productId,
  brand,
  name,
  description,
  priceCents,
  compareAtCents,
  ratingAvg,
  reviewCount,
  soldCount,
  isAvailable,
  asset,
}: PdpInfoProps) {
  const off = discountPercent(priceCents, compareAtCents);

  /**
   * Only what the database actually holds.
   *
   * `DigitalAsset` records a filename, a MIME type, a byte count and a version
   * string — so those are the four facts that can be stated. There is no skill
   * level, no materials list and no tools list anywhere in the schema, so none
   * is shown: a "Beginner" badge with no column behind it would be the same
   * invention as a size chart on a file.
   */
  const facts = [
    asset && { icon: FileText, label: formatLabel(asset.contentType, asset.filename) },
    asset && asset.bytes > 0 && { icon: HardDrive, label: formatBytes(asset.bytes) },
    { icon: Zap, label: "Instant download" },
    { icon: InfinityIcon, label: "Yours to re-download" },
    { icon: Lock, label: "Secure, expiring link" },
  ].filter(Boolean) as { icon: typeof Zap; label: string }[];

  return (
    <div className="flex flex-col gap-[38px]">
      <div className="flex flex-col gap-14">
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-7">
            {/* Says what kind of thing this is before anything else. A shopper
                arriving from a search result should not have to reach the file
                facts to learn nothing will be posted to them. */}
            <span className="font-clash inline-flex w-fit items-center gap-2 rounded-full bg-pdp-surface px-3 py-1.5 text-sm leading-none font-semibold tracking-[0.02em] text-pdp-meta uppercase">
              <Download className="size-3.5 shrink-0" aria-hidden />
              Digital product
            </span>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3">
                <p className="font-clash text-base leading-[1.2] font-medium tracking-[0.16px] text-pdp-label">
                  {brand}
                </p>
                <h1 className="font-clash text-[1.75rem] leading-[1.2] font-semibold tracking-[-0.18px] text-pdp-title sm:text-[2.25rem]">
                  {name}
                </h1>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="flex items-center gap-4">
                  {compareAtCents && off !== null && (
                    <span className="font-clash text-lg leading-[1.2] font-medium text-pdp-body line-through">
                      {formatMoney(compareAtCents)}
                    </span>
                  )}
                  <span className="font-clash text-[1.75rem] leading-[1.2] font-semibold text-pdp-price">
                    {formatMoney(priceCents)}
                  </span>
                </p>

                <div className="flex items-center gap-2">
                  {/* Only shown once something has actually sold — the design's
                      "1,238 Sold" is a real figure or it is not there. */}
                  {soldCount > 0 && (
                    <>
                      <span className="font-clash text-xl leading-none text-pdp-body">
                        {soldCount.toLocaleString("en-US")} Sold
                      </span>
                      <span aria-hidden className="size-1.5 rounded-full bg-pdp-border" />
                    </>
                  )}

                  {reviewCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="size-6 fill-pdp-star text-pdp-star" aria-hidden />
                      <span className="font-clash text-2xl leading-none font-semibold text-pdp-price">
                        {ratingAvg.toFixed(1)}
                      </span>
                      <span className="sr-only">
                        out of 5, from {reviewCount} reviews
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <hr className="border-pdp-hairline" />
          </div>

          <div className="flex flex-col gap-10">
            <PdpDescription text={description} />

            <div className="flex flex-col gap-[18px]">
              <p className="font-clash text-xl leading-[1.2] font-medium text-pdp-label">
                What you get:{" "}
                <span className="font-semibold text-pdp-title">
                  {asset
                    ? `1 file${asset.version ? ` · version ${asset.version}` : ""}`
                    : "Digital download"}
                </span>
              </p>

              {/* The filename itself, because it is the most concrete thing we
                  can honestly say about what arrives. One file per product —
                  `DigitalAsset.productId` is unique, so there is never a
                  bundle to enumerate. */}
              {asset && (
                <p className="font-clash text-base leading-[1.4] text-pdp-body">
                  <span className="font-medium text-pdp-meta">{asset.filename}</span>
                </p>
              )}

              <ul className="flex flex-wrap gap-x-[14px] gap-y-3">
                {facts.map((fact) => (
                  <li
                    key={fact.label}
                    className="font-clash inline-flex h-10 items-center gap-2 rounded-[8px] border border-pdp-hairline px-4 text-base leading-[1.2] font-medium text-pdp-meta"
                  >
                    <fact.icon className="size-4 shrink-0" aria-hidden />
                    {fact.label}
                  </li>
                ))}
              </ul>

              {/* How access actually works, stated once. Every clause here is
                  enforced somewhere: the webhook grants access, the account
                  page lists it, and the download route signs a URL that
                  expires in five minutes. */}
              <p className="font-clash text-base leading-[1.5] text-pdp-body">
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
            </div>
          </div>
        </div>

        <PdpBuyActions
          productId={productId}
          isAvailable={isAvailable}
        />
      </div>

      <Link
        href="/refunds"
        className="font-clash text-base leading-[1.2] font-medium text-pdp-subtle underline underline-offset-2 hover:text-pdp-price"
      >
        Refund policy
      </Link>
    </div>
  );
}
