import Image from "next/image";

import { getPublicProjectsForProduct } from "@/lib/queries/projects";

/**
 * "Made by our makers" — finished pieces from customers who bought this
 * pattern.
 *
 * Reads only through `getPublicProjectsForProduct`, which applies the one
 * public-visibility rule: approved, on a published product, and carrying a
 * public image reference. Approved photos are not published yet, so today
 * that is nothing, and this renders nothing at all — no heading over an empty
 * row and no placeholder dressed as a customer photo, as `PdpProductRail` does
 * for an empty rail.
 *
 * A failed read also renders nothing. The gallery is an extra on the page;
 * it must never take the product page down with it.
 */
export async function PdpProjects({ productId, productName }: { productId: string; productName: string }) {
  let projects: Awaited<ReturnType<typeof getPublicProjectsForProduct>>;
  try {
    projects = await getPublicProjectsForProduct(productId, 8);
  } catch (error) {
    console.error("[projects] product page gallery unavailable:", error instanceof Error ? error.constructor.name : "unknown");
    return null;
  }

  const shown = projects.flatMap((project) => (project.imageUrl ? [{ ...project, imageUrl: project.imageUrl }] : []));
  if (shown.length === 0) return null;

  return (
    <section aria-labelledby="makers-heading" className="w-full">
      <div className="border-b border-pdp-hairline pb-5">
        <h2
          id="makers-heading"
          className="font-display text-[1.5rem] leading-[1.1] font-semibold tracking-[-0.02em] text-pdp-price sm:text-[1.875rem]"
        >
          Made by our makers
        </h2>
        <p className="font-clash mt-2 text-sm text-pdp-subtle">Finished pieces from customers who made this pattern.</p>
      </div>

      <ul className="mt-8 grid grid-cols-2 gap-x-[22px] gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((project) => (
          <li key={project.id}>
            <figure>
              <div className="relative aspect-square overflow-hidden rounded-[8px] bg-pdp-surface">
                <Image
                  src={project.imageUrl}
                  alt={`${productName} made by ${project.displayName ?? "a Meemi maker"}`}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="font-clash mt-3 space-y-1">
                <span className="block text-sm font-medium text-pdp-title">{project.displayName ?? "Meemi maker"}</span>
                {project.caption && (
                  <span className="line-clamp-3 block text-sm leading-[1.5] whitespace-pre-line text-pdp-body">
                    {project.caption}
                  </span>
                )}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
