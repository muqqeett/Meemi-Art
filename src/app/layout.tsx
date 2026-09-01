import type { Metadata, Viewport } from "next";

import { siteConfig } from "@/lib/config";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MotionProvider } from "@/components/motion/motion-provider";

import "./globals.css";

/**
 * Typefaces.
 *
 * All six faces — DM Sans, Fraunces, Kalam, Caveat, Source Sans 3 and Raleway —
 * are self-hosted from `public/fonts` and declared in `src/app/fonts.css`,
 * which also defines the `--font-*` custom properties this file used to inject
 * through `next/font/google` classes on <html>.
 *
 * Nothing is imported here any more, and that is the point: `next/font/google`
 * downloads each binary at compile time under a 3 s dev-only timeout, and a
 * slow response leaves Turbopack caching a failed module resolution that 500s
 * every route. See the header of `fonts.css` for the full explanation.
 *
 * Clash Grotesk is the exception and still comes from Fontshare's CDN — see the
 * <head> below.
 */

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    "handmade crochet",
    "crochet bags",
    "crochet flowers",
    "crochet bouquets",
    "crochet plushies",
    "handmade gifts",
    siteConfig.name,
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    locale: "en_US",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: siteConfig.url,
    /**
     * The share image for every page that does not set its own.
     *
     * Product pages override this with their own photography via
     * `generateMetadata`; everything else — the homepage, /shop, /about, the
     * policy pages — had no image at all, which meant the `summary_large_image`
     * card declared just below rendered as an empty box wherever the site was
     * linked.
     *
     * This is the existing homepage hero asset, not a new one. It is 1200x1124
     * rather than the 1200x630 the platforms crop to, so they will trim the top
     * and bottom; that is preferable to inventing artwork for the sake of a
     * ratio.
     */
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 1124,
        alt: `${siteConfig.name} — ${siteConfig.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    // The card type above promises an image; without one the post renders as a
    // blank panel. Same asset as `openGraph.images`, and product pages still
    // override both with their own photography.
    images: [siteConfig.ogImage],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#24113f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className="h-full"
    >
      <head>
        {/*
          Clash Grotesk — the product page's face. It is a Fontshare release,
          not a Google one, so `next/font/google` cannot fetch it and it is
          linked from its own CDN instead.

          The trade-off is deliberate: self-hosting via `next/font/local` would
          drop the third-party request and the flash it can cause, but it means
          committing font binaries to the repository. Swap to that by
          downloading the three weights and pointing `--font-clash` at them —
          nothing else has to change.
        */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=clash-grotesk@400,500,600&display=swap"
        />

        {/*
          Google AdSense site verification.

          Written as a plain tag in the document head rather than through
          `next/script`, because AdSense's crawler looks for this exact snippet
          inside `<head>` and that is the one place `next/script` does not
          promise to put it. Being in the root layout, it is served on every
          route.

          `async` keeps it off the critical path, so a slow or blocked response
          from Google cannot delay first render.
        */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6533323345817151"
          crossOrigin="anonymous"
        />
      </head>
      <body className="flex min-h-full flex-col">
        <MotionProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </MotionProvider>
        <Toaster position="bottom-right" closeButton />
      </body>
    </html>
  );
}
