import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlumPage, PlumPageHead } from "@/components/shop/plum-page-head";
import { ShopResults } from "@/components/shop/shop-results";
import { listProducts } from "@/lib/queries/products";
import {
  getCategoryBySlug,
  getAllCategories,
  getAllCategorySlugs,
} from "@/lib/queries/categories";
import { parseFilters, buildBaseQuery, isFacetedView } from "@/lib/shop-params";
import { siteConfig } from "@/lib/config";

export async function generateStaticParams() {
  const categories = await getAllCategorySlugs();
  return categories.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/shop/[category]">): Promise<Metadata> {
  const [{ category: slug }, raw] = await Promise.all([params, searchParams]);
  const category = await getCategoryBySlug(slug);

  if (!category || !category.isActive) {
    return { title: "Category not found", robots: { index: false, follow: false } };
  }

  const faceted = isFacetedView(raw);
  // An empty category is an under-construction page: it renders "No products
  // yet" and nothing else worth indexing. `follow` stays on so the crawler
  // still reaches the header and footer links from it. Driven by the live
  // count, so publishing a product into the category makes it indexable again
  // with no switch to remember.
  const empty = category._count.products === 0;

  const title = `Handmade ${category.name}`;
  const description =
    category.description ??
    `Shop handmade ${category.name.toLowerCase()} from ${siteConfig.name}, worked by hand in small batches.`;

  return {
    title,
    description,
    // Always the clean category URL: filter and sort permutations consolidate
    // here rather than competing with it.
    alternates: { canonical: `/shop/${category.slug}` },
    robots: faceted || empty ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: `${title} | ${siteConfig.name}`,
      description,
      url: `${siteConfig.url}/shop/${category.slug}`,
      images: category.image ? [{ url: category.image, alt: category.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteConfig.name}`,
      description,
      images: category.image ? [category.image] : undefined,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/shop/[category]">) {
  const [{ category: slug }, raw] = await Promise.all([params, searchParams]);

  const category = await getCategoryBySlug(slug);
  if (!category || !category.isActive) notFound();

  const filters = parseFilters(raw);

  const [result, categories] = await Promise.all([
    listProducts({ ...filters, category: undefined }, { categorySlug: slug }),
    getAllCategories(),
  ]);

  return (
    <PlumPage>
      <PlumPageHead
        crumbs={[{ label: "Shop", href: "/shop" }, { label: category.name }]}
        title={category.name}
        lead={category.description}
      />

      <ShopResults
        result={result}
        categories={categories}
        params={raw}
        basePath={`/shop/${category.slug}`}
        baseQuery={buildBaseQuery(raw)}
        showCategoryFilter={false}
        emptyTitle={`Nothing in ${category.name} matches those filters`}
        emptyDescription="Try widening the price range, or clear the filters to see the whole category."
      />
    </PlumPage>
  );
}
