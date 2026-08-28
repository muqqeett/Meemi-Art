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
    host: siteConfig.url,
  };
}
