import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private and transactional routes. These also carry `noindex`
        // metadata — this is belt and braces.
        disallow: [
          "/admin",
          "/account",
          "/cart",
          "/checkout",
          "/orders",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/search",
          "/api/",
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    // No `host`. `Host:` was a Yandex-only directive that Google ignores; the
    // canonical host is established by the apex -> www redirect and by every
    // canonical, sitemap and structured-data URL using the www origin.
  };
}
