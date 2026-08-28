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
        ],
      },
    ];
  },
};

export default nextConfig;
