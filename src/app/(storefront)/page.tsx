import type { Metadata } from "next";

import { AnnouncementBar } from "@/components/home/figma/announcement-bar";
import { HeroBand } from "@/components/home/figma/hero-band";
import {
  CategoryCircles,
  type CircleTile,
} from "@/components/home/figma/category-circles";
import { GiftingGrid, type GiftTile } from "@/components/home/figma/gifting-grid";
import { ReviveBanner } from "@/components/home/figma/revive-banner";
import { WhoAreWe } from "@/components/home/figma/who-are-we";
import { TrustRow, type TrustItem } from "@/components/home/figma/trust-row";
import { getAllCategories } from "@/lib/queries/categories";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  // `absolute` bypasses the "%s | Meemi Art" template, which would otherwise
  // repeat the brand name twice in the homepage title.
  title: { absolute: `${siteConfig.name} — ${siteConfig.tagline}` },
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

/**
 * The five round tiles, as named in Figma 222:351.
 *
 * The design's labels — Crochets, eBooks, Accessories, Invitations, Stickers —
 * are not the catalogue's six categories, so each is matched to a real
 * category slug where one plausibly exists and falls back to `/shop`. A tile
 * that 404s is worse than one that lands on the full listing.
 */
const CIRCLE_DESIGN: { label: string; image: string; slugs: string[] }[] = [
  { label: "Crochets", image: "/home/cat-crochets.png", slugs: ["crochet-bags", "crochet-plushies"] },
  { label: "eBooks", image: "/home/cat-ebooks.png", slugs: [] },
  { label: "Accessories", image: "/home/cat-accessories.png", slugs: ["crochet-accessories"] },
  { label: "Invitations", image: "/home/cat-invitations.png", slugs: ["crochet-flowers"] },
  { label: "Stickers", image: "/home/cat-stickers.png", slugs: ["crochet-gifts"] },
];

/**
 * "Shop our top gifting ideas" — Figma 222:377. Labels verbatim.
 *
 * Order matters: the first tile is the landscape one in row one, the second is
 * the square beside it, and the rest fill row two. Dimensions are the exported
 * files' own, so the grid can hold each tile's real shape.
 */
const GIFT_TILES: GiftTile[] = [
  { label: "Wedding Accessories", href: "/shop", image: "/home/gift-wedding.png", width: 797, height: 393 },
  { label: "Gift for her", href: "/shop", image: "/home/gift-for-her.png", width: 1080, height: 1080 },
  { label: "Holiday Gifts", href: "/shop", image: "/home/gift-holiday.png", width: 393, height: 393 },
  { label: "Home Decor", href: "/shop", image: "/home/gift-home-decor.png", width: 1080, height: 1080 },
  { label: "Literature & Books", href: "/shop", image: "/home/gift-literature.png", width: 393, height: 393 },
];

/**
 * Trust signals — Figma 222:438.
 *
 * The design's four claims are: "Worldwide Shipping — available as standard or
 * express delivery", "Secure Payments — 100% Secure Payment with Lemon
 * Squeezy", "Free Return — exchange or money back guarantee for all orders",
 * and "Support — 24/7 support".
 *
 * Three of those are untrue of this shop and one names the wrong company:
 * nothing is posted, the payment provider is Paddle, and a downloaded file
 * cannot be exchanged. These are also the exact claims a payment provider
 * reads during verification. They are stated accurately here instead, in the
 * design's layout and typography. The original wording is above if you want it
 * back — it is a four-line change.
 */
const TRUST_ITEMS: TrustItem[] = [
  {
    title: "Instant Download",
    body: "Your files are ready the moment payment clears",
    href: "/faq",
  },
  {
    title: "Secure Payments",
    body: "Card details are handled by Paddle and never touch this site",
    href: "/faq",
  },
  {
    title: "Refunds",
    body: "Digital files can't be returned, so refunds are handled case by case",
    href: "/refunds",
  },
  {
    title: "Support",
    body: `Questions answered by a person at ${siteConfig.email}`,
    href: "/contact",
  },
];

export default async function HomePage() {
  const categories = await getAllCategories();
  const bySlug = new Map(categories.map((category) => [category.slug, category]));

  const circles: CircleTile[] = CIRCLE_DESIGN.map((tile) => {
    const match = tile.slugs.find((slug) => bySlug.has(slug));
    return {
      label: tile.label,
      image: tile.image,
      href: match ? `/shop/${match}` : "/shop",
    };
  });

  return (
    <>
      <AnnouncementBar />
      <HeroBand />
      <CategoryCircles tiles={circles} />
      <GiftingGrid tiles={GIFT_TILES} />
      <ReviveBanner />
      <WhoAreWe />
      <TrustRow items={TRUST_ITEMS} />
    </>
  );
}
