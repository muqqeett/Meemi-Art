import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces, Kalam, Caveat, Source_Sans_3, Raleway } from "next/font/google";

import { siteConfig } from "@/lib/config";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MotionProvider } from "@/components/motion/motion-provider";

import "./globals.css";

/** UI and body copy — geometric, warm, excellent at small sizes. */
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/**
 * Display face. Fraunces carries the handmade character of the brand without
 * tipping into craft-fair territory — its soft, high-contrast forms do the
 * editorial work that the palette deliberately leaves alone.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/**
 * Hero headline face.
 *
 * The design specifies Segoe Print, which ships only with Windows — on macOS,
 * iOS, Android and Linux it silently falls back to a generic cursive and the
 * headline stops looking designed. Kalam is the closest freely-servable match
 * (upright, casual print hand, has a real 700). The stack in `--font-hand`
 * lists Segoe Print first, so Windows still renders the exact drawn shapes and
 * everyone else gets a near match rather than a default.
 */
const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

/**
 * The homepage's script and wordmark faces.
 *
 * Same substitution problem as Kalam: the design is set in Segoe Script and
 * Source Sans 3, and Segoe Script ships only with Windows. Caveat is the
 * closest freely-servable connected script; Source Sans 3 is on Google Fonts
 * under its own name, so the wordmark is exact everywhere.
 */
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["600", "800"],
  display: "swap",
});

/**
 * Product-detail headings — Figma "Description:", "Reviews Filter" etc.
 *
 * Only the two weights the design uses, so the page does not download five it
 * never sets.
 */
const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

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
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
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
      className={`${dmSans.variable} ${fraunces.variable} ${kalam.variable} ${caveat.variable} ${sourceSans.variable} ${raleway.variable} h-full`}
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
