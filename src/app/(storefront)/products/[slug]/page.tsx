import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/brand/breadcrumbs";
import { PdpGallery } from "@/components/product/pdp/pdp-gallery";
import { PdpInfo } from "@/components/product/pdp/pdp-info";
import { PdpBuyBlock } from "@/components/product/pdp/pdp-buy-block";
import { PdpProductRail } from "@/components/product/pdp/pdp-product-rail";
import { PdpReviews } from "@/components/product/pdp/pdp-reviews";
import { PdpProjects } from "@/components/product/pdp/pdp-projects";
import { PdpLearn } from "@/components/product/pdp/pdp-learn";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { MeemiGuideLoader } from "@/components/product/meemi/meemi-guide-loader";
import { ProductViewBeacon } from "@/components/product/product-view-beacon";
import { isAssistantConfigured } from "@/lib/ai/client";
import { meemiFactsFor } from "@/lib/meemi/facts";
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
import { entityIds, siteConfig } from "@/lib/config";
import { safeJsonLd } from "@/lib/json-ld";

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
      // Restated because a page-level `openGraph` replaces the root one whole.
      siteName: siteConfig.name,
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
  const productUrl = `${siteConfig.url}/products/${product.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    url: productUrl,
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
      url: productUrl,
      // The sitewide Organization by reference, not a second anonymous copy
      // of it — see `components/brand/organization-schema.tsx`.
      seller: { "@id": entityIds.organization },
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
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      {/*
        Product detail — Plum Studio "Product" (19:1214).

        The design's header and footer are the site's own (the Plum chrome the
        storefront layout supplies), so none is built here.

        1280 frame, 32px gutters, a 600px gallery and a 56px gap, the info
        column taking the rest. Below lg it stacks.

        Three blocks, two placements. On a phone this is one column and the
        source order rules: gallery, purchase, then everything to read. From
        `lg` the gallery spans both rows of column one while the detail column
        stacks reading above buying, which puts the CTA where the eye lands
        after the tabs. One `PdpBuyBlock` serves both, moved by grid placement
        rather than rendered twice, so its add-to-cart state is never
        duplicated and a screen reader meets one "Add to cart" button.

        `[&>*]:min-w-0` because a grid item's automatic minimum is its
        min-content width, and the gallery's fixed-size thumbnails would
        otherwise hold the column open on a narrow screen.
      */}
      <div data-fill className="font-figtree w-full bg-pl-page text-pl-text">
      <div className="mx-auto w-full max-w-[1280px] px-4 pt-6 pb-20 sm:px-6 lg:px-8 lg:pt-8">
        <Breadcrumbs
          variant="plum"
          items={[
            { label: "Shop", href: "/shop" },
            { label: product.category.name, href: `/c/${product.category.slug}` },
            { label: product.name },
          ]}
        />

        <div className="mt-6 grid items-start gap-8 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-x-14 lg:gap-y-8 wide:grid-cols-[600px_minmax(0,1fr)]">
          {/* Above the fold, so it animates on mount rather than paying for a
              viewport observer that would fire immediately. */}
          <Reveal variant="in" onMount className="lg:col-start-1 lg:row-start-1 lg:row-span-2">
            <PdpGallery
              images={product.images}
              // Gallery-only. The video never feeds the JSON-LD `image`, the
              // Open Graph or Twitter image, cards or checkout — all of those
              // keep reading `product.images` above.
              videoUrl={product.videoUrl}
              productId={product.id}
              productName={product.name}
              isWishlisted={product.isWishlisted}
            />
          </Reveal>

          {/* Second on mobile, last in the detail column on desktop.
              `data-meemi-avoid`: the Meemi guide hides rather than cover it. */}
          <div className="lg:col-start-2 lg:row-start-2" data-meemi-avoid>
            <PdpBuyBlock
              productId={product.id}
              productName={product.name}
              isAvailable={product.isAvailable}
              isWishlisted={product.isWishlisted}
            />
          </div>

          <Reveal variant="in" onMount className="lg:col-start-2 lg:row-start-1">
            <PdpInfo
              brand={product.brand}
              name={product.name}
              categoryName={product.category.name}
              description={product.description}
              priceCents={product.priceCents}
              compareAtCents={product.compareAtCents}
              ratingAvg={product.ratingAvg}
              reviewCount={product.reviewCount}
              productName={product.name}
              soldCount={soldCount}
              asset={product.asset}
              difficulty={product.difficulty}
            />
          </Reveal>
        </div>

        <div className="mt-20 flex flex-col gap-20">
          {/* Renders nothing unless a published guide covers a technique this
              pattern is actually tagged with. */}
          <PdpLearn
            techniques={product.difficulty?.enabled ? product.difficulty.techniques : []}
            productName={product.name}
          />

          <PdpProductRail
            title="Related Product"
            href={`/c/${product.category.slug}`}
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

          {/* Renders nothing until an approved project has a public photo. */}
          <PdpProjects productId={product.id} productName={product.name} />

          <PdpProductRail
            title="Popular this week"
            href="/shop?sort=rating"
            products={popular}
            soldCounts={soldCounts}
          />
        </div>
      </div>
      </div>

      <RecentlyViewed currentSlug={product.slug} />

      {/* Meemi, the product page's crochet guide. Client-only and lazy: nothing
          in the server HTML. Its facts are derived here, from the product and
          its enabled difficulty assessment, never in the browser. "Ask Meemi"
          is offered only where the Pattern guide itself is mounted — the same
          condition the storefront layout uses. */}
      <MeemiGuideLoader
        facts={meemiFactsFor(product)}
        assistantAvailable={isAssistantConfigured() || process.env.NODE_ENV === "development"}
      />

      {/* Counts the view once the page is really seen. Renders nothing, sets no
          cookie; see `lib/analytics/product-views.ts`. */}
      <ProductViewBeacon productId={product.id} />
    </>
  );
}
