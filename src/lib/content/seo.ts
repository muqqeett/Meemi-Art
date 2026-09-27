import type { Metadata } from "next";

import { siteConfig } from "@/lib/config";

/**
 * Metadata for a public learning page.
 *
 * One helper so every article, tutorial and resource gets the same treatment:
 * a real title, a real description, a self-referencing canonical, and Open
 * Graph that restates what a page-level `openGraph` would otherwise drop from
 * the root layout.
 *
 * Nothing here invents a description. A page that cannot describe itself in a
 * sentence has a content problem, not a metadata problem.
 */
export function learnMetadata({
  title,
  description,
  path,
  type = "website",
  image,
  publishedTime,
  modifiedTime,
  canonicalOverride,
}: {
  title: string;
  description: string;
  /** Site-relative, e.g. "/resources/hook-sizes". */
  path: string;
  type?: "website" | "article";
  image?: { url: string; alt: string } | null;
  publishedTime?: string;
  modifiedTime?: string;
  /** Set only where the page is a secondary copy of something else. */
  canonicalOverride?: string | null;
}): Metadata {
  const url = `${siteConfig.url}${path}`;
  const images = image ? [{ url: image.url, alt: image.alt }] : [{ url: siteConfig.ogImage, alt: siteConfig.name }];

  return {
    title,
    description,
    alternates: { canonical: canonicalOverride ?? path },
    openGraph: {
      type,
      siteName: siteConfig.name,
      locale: "en_US",
      title,
      description,
      url: canonicalOverride ?? url,
      images,
      ...(type === "article" && publishedTime ? { publishedTime } : {}),
      ...(type === "article" && modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((entry) => entry.url),
    },
  };
}
