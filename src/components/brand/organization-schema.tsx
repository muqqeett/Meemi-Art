import { entityIds, siteConfig } from "@/lib/config";
import { safeJsonLd } from "@/lib/json-ld";

/**
 * Organization and WebSite structured data, emitted once from the storefront
 * layout.
 *
 * Only facts we actually have are included — there is no invented postal
 * address, telephone number or social profile. `sameAs` is omitted entirely
 * unless real profile URLs are configured.
 *
 * ── One entity each, however many pages carry them ─────────────────────────
 *
 * Both blocks have a stable `@id` (see `entityIds`), and the WebSite names the
 * Organization as its publisher by that id rather than by restating it. Product
 * offers refer to the same id as their seller. Google therefore reads a single
 * business and a single site, not a fresh copy per page.
 *
 * ── Logo ───────────────────────────────────────────────────────────────────
 *
 * `logo` is the official "MA" monogram (`siteConfig.logo`), a static square
 * file on the canonical origin. It is identity data only — the visible header
 * keeps its typographic wordmark.
 *
 * ── Deliberately absent ────────────────────────────────────────────────────
 *
 * `potentialAction` / SearchAction — Google retired the sitelinks search box it
 * powered, and the `/search` URL it pointed at is disallowed in robots.txt and
 * marked `noindex`, so it advertised a page crawlers are told not to use.
 */
export function OrganizationSchema() {
  const sameAs = Object.values(siteConfig.social).filter(Boolean);

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": entityIds.organization,
    name: siteConfig.name,
    alternateName: siteConfig.alternateName,
    description: siteConfig.description,
    url: entityIds.home,
    // The official monogram, as an absolute URL on the canonical origin.
    logo: {
      "@type": "ImageObject",
      "@id": `${siteConfig.url}/#logo`,
      url: `${siteConfig.url}${siteConfig.logo.src}`,
      contentUrl: `${siteConfig.url}${siteConfig.logo.src}`,
      width: siteConfig.logo.width,
      height: siteConfig.logo.height,
      caption: siteConfig.name,
    },
    image: { "@id": `${siteConfig.url}/#logo` },
    email: siteConfig.email,
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": entityIds.website,
    name: siteConfig.name,
    alternateName: siteConfig.alternateName,
    url: entityIds.home,
    inLanguage: "en",
    publisher: { "@id": entityIds.organization },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(website) }}
      />
    </>
  );
}
