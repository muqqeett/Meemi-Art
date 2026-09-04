import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Catalog photography is served from Unsplash's CDN in development.
    // Swap for your own bucket in production — `domains` is deprecated in 16.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      // Product photography uploaded through the admin.
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      { protocol: "https", hostname: "i.pravatar.cc", pathname: "/**" },
    ],
    // Next 16 defaults to `[75]` only; the gallery and thumbnails need a range.
    qualities: [60, 75, 90],
    formats: ["image/avif", "image/webp"],
  },

  // Never leak framework details in response headers.
  poweredByHeader: false,

  /**
   * Routes retired when the shop became digital-only.
   *
   * `/shipping` and `/size-guide` described posting physical goods and the
   * dimensions of physical objects. Neither applies to a downloadable file, so
   * both pages are gone — but they were linked from emails already delivered
   * and from pages search engines have indexed, so they redirect rather than
   * 404. `/shipping#returns` lands on the refund policy too: the fragment is
   * dropped by the browser, and the target now covers what it was pointing at.
   *
   * Permanent (308), because these moves are not coming back.
   */
  async redirects() {
    return [
      { source: "/shipping", destination: "/refunds", permanent: true },
      { source: "/size-guide", destination: "/faq", permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          /**
           * Report-Only, deliberately.
           *
           * A `Content-Security-Policy` header enforces immediately, and this
           * policy has not yet been proven against a real checkout. Paddle
           * opens an overlay from its own origin, Cloudinary serves every
           * product image, and Next.js injects inline bootstrap script and
           * style on each page. Get any one of those wrong under enforcement
           * and the failure is a shopper who cannot pay.
           *
           * `-Report-Only` sends the identical policy, blocks nothing, and
           * reports violations to the browser console. That turns the question
           * "is this policy correct?" from a guess into an observation.
           *
           * ── Promoting this to enforcement ──────────────────────────────
           *
           * Browse the storefront, complete a sandbox checkout, sign in, and
           * open the admin. Read the console on each. When a full purchase
           * produces no violation, rename this key to `Content-Security-Policy`
           * — the value does not change.
           *
           * ── Why each source is here ────────────────────────────────────
           *
           * `'unsafe-inline'` on script-src is required by Next's inline
           * bootstrap; removing it needs per-request nonces, which the static
           * `headers()` config cannot produce. `'unsafe-eval'` is present for
           * development only. Both weaken the policy against a determined XSS
           * — noted honestly. Even so, the policy still constrains where
           * script may be *fetched* from and where data may be *sent*, which
           * is what turns an injection into a dead end rather than an
           * exfiltration channel.
           *
           * `frame-ancestors 'none'` restates X-Frame-Options above in the
           * modern form; both are kept because the older header is what some
           * scanners and older browsers read.
           */
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              /* Paddle's checkout script and its sandbox equivalent, plus
                 AdSense. The Google hosts are not aspirational — a report-only
                 run showed the storefront already loading
                 `pagead2.googlesyndication.com`, which then pulls
                 `adtrafficquality.google` and frames `googleads.g.doubleclick.net`.
                 A policy written without them would have blanked the ads the
                 moment it was enforced. */
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.paddle.com https://sandbox-cdn.paddle.com https://pagead2.googlesyndication.com https://*.adtrafficquality.google",
              /* Tailwind and Next emit inline style attributes. Fontshare
                 serves the Clash Grotesk stylesheet the product page is set
                 in — also found by the report-only run, and the reason
                 `style-src` cannot be `'self'` alone. */
              "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
              // Cloudinary serves product imagery; blob:/data: cover Next's
              // image optimiser and inline SVG placeholders. The other two
              // hosts are here because `images.remotePatterns` above already
              // permits them — a policy that contradicts the image config
              // would report violations that are not violations, and would
              // blank those images the day it is enforced.
              "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://i.pravatar.cc https://*.adtrafficquality.google https://pagead2.googlesyndication.com",
              "font-src 'self' data: https://cdn.fontshare.com",
              // Paddle's API, and its event/telemetry endpoints.
              "connect-src 'self' https://*.paddle.com https://*.adtrafficquality.google https://pagead2.googlesyndication.com",
              // The checkout overlay is an iframe from Paddle.
              "frame-src https://*.paddle.com https://googleads.g.doubleclick.net https://*.adtrafficquality.google https://www.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
