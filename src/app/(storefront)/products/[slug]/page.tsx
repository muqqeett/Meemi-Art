import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/brand/breadcrumbs";
import { PdpGallery } from "@/components/product/pdp/pdp-gallery";
import { PdpInfo } from "@/components/product/pdp/pdp-info";
import { PdpProductRail } from "@/components/product/pdp/pdp-product-rail";
import { PdpReviews } from "@/components/product/pdp/pdp-reviews";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { Reveal } from "@/components/motion/reveal";
import {
  getProductBySlug,
  getRelatedProducts,
  getBestSellers,
  getAllProductSlugs,
} from "@/lib/queries/products";
import { getSoldCounts } from "@/lib/queries/sales";
import {
  getVerifiedReviewerIds,
  getReviewEligibility,
  type OwnReview,
} from "@/lib/queries/reviews";
import { getCurrentUser } from "@/lib/auth-guards";
import { siteConfig } from "@/lib/config";

export async function generateStaticParams() {
  const products = await getAllProductSlugs();
  return products.slice(0, 24).map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "Product not found", robots: { index: false, follow: false } };
  }

  // Admin-authored overrides win; otherwise metadata is derived from the record.
  const custom = product.seoTitle?.trim();
  const baseTitle = custom || product.name;
  const description =
    product.seoDescription ??
    product.shortDescription ??
    product.description.slice(0, 155).trim();

  return {
    // An admin-authored SEO title is written complete, brand and all, so it is
    // marked absolute to bypass the root layout's "%s | Meemi Art" template —
    // otherwise the brand appears twice.
    title: custom ? { absolute: custom } : baseTitle,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: "website",
      title: custom || `${baseTitle} | ${siteConfig.name}`,
      description,
      url: `${siteConfig.url}/products/${product.slug}`,
      images: product.images.map((image) => ({ url: image.url, alt: image.alt })),
    },
    twitter: {
      card: "summary_large_image",
      title: custom || `${baseTitle} | ${siteConfig.name}`,
      description,
      images: product.images[0]?.url ? [product.images[0].url] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const [related, popular] = await Promise.all([
    getRelatedProducts(product.id, product.categoryId, 5),
    getBestSellers(5),
  ]);

  // One query for every card on the page plus the product itself, rather than
  // one per card.
  const soldCounts = await getSoldCounts([
    product.id,
    ...related.map((item) => item.id),
    ...popular.map((item) => item.id),
  ]);
  const soldCount = soldCounts.get(product.id) ?? 0;

  // Who wrote each review, and which of them actually bought this product.
  // Both read-only; nothing here grants anything.
  const viewer = await getCurrentUser();
  const verifiedReviewerIds = await getVerifiedReviewerIds(
    product.id,
    product.reviews.map((review) => review.userId),
  );

  /**
   * May the reader review this, and have they already?
   *
   * This is the surface that makes the review permanently reachable: the
   * customer does not have to find the original order months later, they just
   * open the product. Eligibility is the purchase itself, with no time bound.
   */
  const eligibility = viewer
    ? await getReviewEligibility(viewer.id, [product.id])
    : new Map<string, OwnReview | null>();
  const canReview = eligibility.has(product.id);
  const ownReview = eligibility.get(product.id) ?? null;

  /**
   * Product structured data. Rating and review fields are only emitted when
   * real reviews exist — never fabricated to win a rich result.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription ?? product.description.slice(0, 300),
    sku: product.sku,
    brand: { "@type": "Brand", name: siteConfig.name },
    category: product.category.name,
    image: product.images.map((image) => image.url),
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: (product.priceCents / 100).toFixed(2),
      // A file never runs out. Availability tracks whether it is published
      // and has an asset behind it, not a stock level.
      availability: product.isAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${siteConfig.url}/products/${product.slug}`,
      seller: { "@type": "Organization", name: siteConfig.name },
    },
    ...(product.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.ratingAvg,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/*
        Product detail — Figma 57:1305.

        The design's own header and footer are not built here: this site has
        one of each already, and a product page carrying a second set would be
        the only page that does.

        Its 1512 frame holds a 1200 content column, so from 1440 up the gutter
        is the homepage's own 120px and the two pages' left edges land on the
        same line. Below that the gutter narrows rather than holding 240px of
        empty margin around a column that no longer has room for it — the
        homepage keeps its own ladder, so nothing there moves.
      */}
      <div className="mx-auto w-full max-w-[1440px] bg-white px-5 py-8 sm:max-lg:px-8 lg:max-wide:px-12 lg:py-10 wide:px-[120px]">
        <Breadcrumbs
          items={[
            { label: "Shop", href: "/shop" },
            { label: product.category.name, href: `/shop/${product.category.slug}` },
            { label: product.name },
          ]}
        />

        {/* The drawn split — 545 + 135 + 520 — needs 1200 of content to exist,
            so it is held only from 1440 up, where it does. Between lg and there
            the same two columns share the width by ratio; below lg they stack.

            The ranges are written disjoint (`lg:max-wide:` against `wide:`)
            rather than as a plain `lg:` that `wide:` overrides — see the note
            on `--breakpoint-wide` in globals.css for why the override loses.

            `[&>*]:min-w-0` because a grid item's automatic minimum is its
            min-content width, and the gallery's fixed 76px thumbnails would
            otherwise hold the column open at 364px on a 375px screen. */}
        <div className="mt-8 grid items-start gap-10 [&>*]:min-w-0 lg:max-wide:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] lg:max-wide:gap-12 wide:grid-cols-[545px_1fr] wide:gap-[135px]">
          {/* Both columns are above the fold, so they animate on mount rather
              than paying for a viewport observer that would fire immediately. */}
          <Reveal variant="in" onMount>
            <PdpGallery
              images={product.images}
              productId={product.id}
              productName={product.name}
              isWishlisted={product.isWishlisted}
            />
          </Reveal>

          <Reveal variant="in" onMount>
            <PdpInfo
              productId={product.id}
              brand={product.brand}
              name={product.name}
              description={product.description}
              priceCents={product.priceCents}
              compareAtCents={product.compareAtCents}
              ratingAvg={product.ratingAvg}
              reviewCount={product.reviewCount}
              soldCount={soldCount}
              isAvailable={product.isAvailable}
              asset={product.asset}
            />
          </Reveal>
        </div>

        <div className="mt-20 flex flex-col gap-20">
          <PdpProductRail
            title="Related Product"
            href={`/shop/${product.category.slug}`}
            products={related}
            soldCounts={soldCounts}
          />

          <PdpReviews
            reviews={product.reviews}
            average={product.ratingAvg}
            count={product.reviewCount}
            viewerId={viewer?.id ?? null}
            verifiedReviewerIds={verifiedReviewerIds}
            productId={product.id}
            productName={product.name}
            canReview={canReview}
            ownReview={ownReview}
          />

          <PdpProductRail
            title="Popular this week"
            href="/shop?sort=rating"
            products={popular}
            soldCounts={soldCounts}
          />
        </div>
      </div>

      <RecentlyViewed currentSlug={product.slug} />
    </>
  );
}
