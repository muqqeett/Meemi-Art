import type { Metadata } from "next";

import { CategoryView, categoryMetadata } from "@/components/category/category-view";

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/c/[category]">): Promise<Metadata> {
  const [{ category }, raw] = await Promise.all([params, searchParams]);
  return categoryMetadata({ slug: category }, raw);
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/c/[category]">) {
  const [{ category }, raw] = await Promise.all([params, searchParams]);
  return <CategoryView route={{ slug: category }} raw={raw} />;
}
