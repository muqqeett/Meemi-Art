import type { Metadata } from "next";

import { CategoryView, categoryMetadata } from "@/components/category/category-view";

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/c/[category]/[sub]">): Promise<Metadata> {
  const [{ category, sub }, raw] = await Promise.all([params, searchParams]);
  return categoryMetadata({ slug: category, sub }, raw);
}

export default async function SubcategoryPage({
  params,
  searchParams,
}: PageProps<"/c/[category]/[sub]">) {
  const [{ category, sub }, raw] = await Promise.all([params, searchParams]);
  return <CategoryView route={{ slug: category, sub }} raw={raw} />;
}
