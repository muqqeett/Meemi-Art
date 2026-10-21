import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { X } from "lucide-react";

import { CategoryHead, type CategoryChip } from "@/components/category/category-head";
import { CategoryFilters } from "@/components/category/category-filters";
import { activePriceChip } from "@/components/category/price-chips";
import { CategoryToolbar } from "@/components/category/category-toolbar";
import { PlumPage } from "@/components/shop/plum-page-head";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { ProductGrid } from "@/components/product/product-grid";
import { PlumButtonLink } from "@/components/ui/plum-button";
import { SORT_OPTIONS, siteConfig } from "@/lib/config";
import { getCategoryPage, type CategoryPageData } from "@/lib/queries/categories";
import { getSkillIndex, parseSkill } from "@/lib/queries/category-facets";
import { listProducts } from "@/lib/queries/products";
import { buildBaseQuery, isFacetedView, parseFilters, type RawSearchParams } from "@/lib/shop-params";
import { shopCategoryFor } from "@/lib/shop-categories";

type CategoryRoute = { slug: string; sub?: string };

/** "Crochet patterns" → "crochet patterns"; "eBooks & guides" stays as it is. */
const inSentence = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

function nounsFor(slug: string) {
  const spec = shopCategoryFor(slug);
  return { singular: spec?.singular ?? "product", plural: spec?.plural ?? "products" };
}

const countLabel = (count: number, slug: string) => {
  const { singular, plural } = nounsFor(slug);
  return `${count} ${count === 1 ? singular : plural}`;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function hrefFor(base: string, raw: RawSearchParams, overrides: Record<string, string | null> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const single = first(value);
    if (single && key !== "page") params.set(key, single);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

const pathFor = ({ slug, sub }: CategoryRoute) => (sub ? `/c/${slug}/${sub}` : `/c/${slug}`);

function leadFor(data: CategoryPageData) {
  const description = (data.sub?.description ?? data.category.description)?.trim();
  const sentence = description && !/[.!?]$/.test(description) ? `${description}.` : description;
  if (data.currentCount === 0) return sentence ?? "Nothing is listed here yet.";
  const count = `${countLabel(data.currentCount, data.category.slug)} · instant download`;
  return sentence ? `${sentence} ${count}` : count;
}

/**
 * Metadata for `/c/[category]` and `/c/[category]/[sub]`.
 *
 * The canonical is always the clean path, so filter, sort and page variants
 * consolidate there rather than competing with it. Those variants, and a
 * category with nothing listed — an under-construction page, however politely
 * worded — are kept out of the index; `follow` stays on so a crawler still
 * reaches the header and footer from them. The empty rule reads the live
 * count, so publishing a product makes the page indexable with no switch.
 */
export async function categoryMetadata(
  route: CategoryRoute,
  raw: RawSearchParams,
): Promise<Metadata> {
  const lookup = await getCategoryPage(route.slug, route.sub);
  if (lookup.status !== "ok") {
    return { title: "Category not found", robots: { index: false, follow: false } };
  }

  const { data } = lookup;
  const title = data.sub ? `${data.sub.name} — ${data.category.name}` : data.category.name;
  const path = pathFor({ slug: data.category.slug, sub: data.sub?.slug });
  const description =
    (data.sub?.description ?? data.category.description)?.trim() ||
    (data.currentCount > 0
      ? `${countLabel(data.currentCount, data.category.slug)} from ${siteConfig.name}. Instant download.`
      : `${title} from ${siteConfig.name} — coming soon.`);
  const indexable = !isFacetedView(raw) && data.currentCount > 0;

  return {
    title,
    description,
    alternates: { canonical: path },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: `${title} | ${siteConfig.name}`,
      description,
      url: `${siteConfig.url}${path}`,
      images: data.category.image ? [{ url: data.category.image, alt: data.category.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteConfig.name}`,
      description,
      images: data.category.image ? [data.category.image] : undefined,
    },
  };
}

function Scene({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={360}
      height={240}
      unoptimized
      className="h-auto w-[240px] sm:w-[360px]"
    />
  );
}

function EmptyPanel({
  scene,
  title,
  body,
  children,
}: {
  scene: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="font-figtree flex flex-col items-center gap-3.5 py-10 text-center">
      <Scene src={scene} />
      <h2 className="pl-display max-w-[560px] text-[26px] leading-[normal] font-bold">{title}</h2>
      <p className="pl-body max-w-[520px] text-pl-muted">{body}</p>
      <div className="flex w-full max-w-[420px] flex-col gap-2.5 sm:w-auto sm:max-w-none sm:flex-row">
        {children}
      </div>
    </div>
  );
}

/**
 * The category / sub-category page — Figma "Shop flow · Category pages".
 *
 * Three honest states: a listing; "Coming soon" when nothing is listed (with
 * what *is* ready to download, so it is never a dead end); and "No results"
 * when filters narrow a real category to nothing.
 */
export async function CategoryView({
  route,
  raw,
}: {
  route: CategoryRoute;
  raw: RawSearchParams;
}) {
  const lookup = await getCategoryPage(route.slug, route.sub);
  if (lookup.status === "missing") notFound();
  if (lookup.status === "redirect") {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      const single = first(value);
      if (single) query.set(key, single);
    }
    const qs = query.toString();
    permanentRedirect(qs ? `${lookup.to}?${qs}` : lookup.to);
  }

  const { data } = lookup;
  const root = data.category;
  const spec = shopCategoryFor(root.slug);
  const base = pathFor({ slug: root.slug, sub: data.sub?.slug });
  const title = data.sub?.name ?? root.name;
  const { plural } = nounsFor(root.slug);

  const chips: CategoryChip[] =
    data.subs.length > 0
      ? [
          { label: `All (${data.totalCount})`, href: `/c/${root.slug}`, selected: !data.sub },
          ...data.subs.map((sub) => ({
            label: `${sub.name} (${sub.count})`,
            href: `/c/${root.slug}/${sub.slug}`,
            selected: data.sub?.slug === sub.slug,
          })),
        ]
      : [];

  const head = (
    <CategoryHead
      crumbs={[
        { label: "Shop", href: "/shop" },
        data.sub ? { label: root.name, href: `/c/${root.slug}` } : { label: root.name },
        ...(data.sub ? [{ label: data.sub.name }] : []),
      ]}
      title={title}
      lead={leadFor(data)}
      spec={spec}
      chips={chips}
    />
  );

  // ------------------------------------------------------------ coming soon
  if (data.currentCount === 0) {
    const ready = await listProducts(parseFilters({}));
    return (
      <>
        {head}
        <PlumPage>
          <div className="pt-6 lg:pt-8">
            <EmptyPanel
              scene="/states/coming-soon.svg"
              title={`New ${data.sub ? inSentence(title) : plural} are on the way`}
              body={
                ready.products.length > 0
                  ? `Nothing in ${inSentence(title)} is listed yet. In the meantime, these are ready to download.`
                  : `Nothing in ${inSentence(title)} is listed yet. Check back soon.`
              }
            >
              <PlumButtonLink href="/shop" style="primary" size="lg">
                Browse the shop
              </PlumButtonLink>
              <PlumButtonLink href="/learn" style="secondary" size="lg">
                Explore free guides
              </PlumButtonLink>
            </EmptyPanel>

            {ready.products.length > 0 && (
              <section aria-labelledby="ready-now" className="mx-auto mt-6 max-w-[928px]">
                <h2 id="ready-now" className="pl-display mb-5 text-[22px] leading-[26px] font-bold">
                  Ready to download now
                </h2>
                <ProductGrid variant="plum" products={ready.products.slice(0, 3)} priorityCount={3} />
              </section>
            )}
          </div>
        </PlumPage>
      </>
    );
  }

  // ------------------------------------------------------------ listing
  const filters = parseFilters(raw);
  const selectedSkill = parseSkill(raw.skill);
  const index = await getSkillIndex(data.listingSlugs);
  const productIds = selectedSkill.length
    ? [...new Set(selectedSkill.flatMap((value) => index.idsByLevel[value] ?? []))]
    : undefined;

  const result = await listProducts(
    { ...filters, category: undefined },
    { categorySlugs: data.listingSlugs, productIds },
  );

  const skillOptions = index.facets;
  const sortLabel =
    SORT_OPTIONS.find((option) => option.value === filters.sort)?.label ?? "Newest";

  // The filters in force, each with the URL that removes just that one.
  const active: { key: string; label: string; remove: string }[] = [
    ...selectedSkill.map((value) => ({
      key: `skill-${value}`,
      label: index.facets.find((f) => f.value === value)?.label ?? value,
      remove: hrefFor(base, raw, {
        skill: selectedSkill.filter((v) => v !== value).join(",") || null,
      }),
    })),
    ...(() => {
      const chip = activePriceChip(first(raw.minPrice), first(raw.maxPrice));
      return chip
        ? [{ key: "price", label: chip.label, remove: hrefFor(base, raw, { minPrice: null, maxPrice: null }) }]
        : first(raw.minPrice) || first(raw.maxPrice)
          ? [{ key: "price", label: "Price range", remove: hrefFor(base, raw, { minPrice: null, maxPrice: null }) }]
          : [];
    })(),
    ...(filters.brand ? [{ key: "brand", label: filters.brand, remove: hrefFor(base, raw, { brand: null }) }] : []),
    ...(filters.rating
      ? [{ key: "rating", label: `${filters.rating}★ & up`, remove: hrefFor(base, raw, { rating: null }) }]
      : []),
    ...(filters.q ? [{ key: "q", label: `“${filters.q}”`, remove: hrefFor(base, raw, { q: null }) }] : []),
  ];

  const filterProps = { skill: skillOptions, params: raw };
  const noun = (n: number) => countLabel(n, root.slug);
  const countText =
    result.total === 0
      ? noun(0)
      : `${noun(result.total)} · sorted by ${sortLabel.toLowerCase()}`;

  return (
    <>
      {head}
      <PlumPage>
        <div className="grid gap-8 pt-6 lg:grid-cols-[256px_1fr] lg:pt-8">
          <aside aria-label="Filters" className="hidden lg:block">
            <div className="sticky top-24">
              <CategoryFilters {...filterProps} />
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-5">
            {/* The product cards title themselves with h3, so the list needs an
                h2 above it or the outline jumps from h1 to h3. */}
            <h2 className="sr-only">Products</h2>
            <CategoryToolbar
              countText={countText}
              total={result.total}
              skill={skillOptions}
              params={raw}
            />

            {active.length > 0 && (
              <div className="font-figtree flex flex-wrap items-center gap-2">
                <ul className="flex flex-wrap gap-2" aria-label="Filters in use">
                  {active.map((filter) => (
                    <li key={filter.key}>
                      <Link
                        href={filter.remove}
                        scroll={false}
                        aria-label={`Remove filter: ${filter.label}`}
                        className="pl-focus inline-flex h-9 items-center gap-1.5 rounded-full border-[1.5px] border-plum-900 bg-pl-inverse px-3 text-[14px] leading-[18px] font-bold text-pl-on-dark"
                      >
                        {filter.label}
                        <X className="size-4" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href={base}
                  scroll={false}
                  className="pl-focus rounded-sm px-1 text-[14px] font-bold text-plum-500 underline"
                >
                  Clear all
                </Link>
              </div>
            )}

            {result.products.length === 0 ? (
              <EmptyPanel
                scene="/states/no-results.svg"
                title={`No ${inSentence(plural)} match these filters`}
                body={`Try removing a filter. There ${data.currentCount === 1 ? "is" : "are"} ${noun(data.currentCount)} in ${root.name}${data.sub ? ` › ${data.sub.name}` : ""}.`}
              >
                <PlumButtonLink href={base} style="primary" size="lg">
                  Clear filters
                </PlumButtonLink>
                <PlumButtonLink
                  href={data.sub ? `/c/${root.slug}` : "/shop"}
                  style="secondary"
                  size="lg"
                >
                  {data.sub ? `See all ${inSentence(root.name)}` : "Browse the whole shop"}
                </PlumButtonLink>
              </EmptyPanel>
            ) : (
              <>
                <ProductGrid variant="plum" products={result.products} priorityCount={3} />
                <PaginationNav
                  page={result.page}
                  pageCount={result.pageCount}
                  baseQuery={buildBaseQuery(raw)}
                  basePath={base}
                />
              </>
            )}
          </div>
        </div>
      </PlumPage>
    </>
  );
}
