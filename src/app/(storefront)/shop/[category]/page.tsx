import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { getCategoryPage } from "@/lib/queries/categories";

/**
 * `/shop/<category>` is the category page's earlier address. Category pages
 * now live at `/c/<category>` (and `/c/<category>/<sub>`), so this permanently
 * redirects there — keeping its query string — and anything that still links
 * here, including links already indexed, lands on the real page.
 *
 * A slug that is not an active category stays a 404.
 */
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function LegacyCategoryPage({
  params,
  searchParams,
}: PageProps<"/shop/[category]">) {
  const [{ category: slug }, raw] = await Promise.all([params, searchParams]);

  const lookup = await getCategoryPage(slug);
  if (lookup.status === "missing") notFound();

  const target = lookup.status === "redirect" ? lookup.to : `/c/${slug}`;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single) query.set(key, single);
  }
  const qs = query.toString();
  permanentRedirect(qs ? `${target}?${qs}` : target);
}
