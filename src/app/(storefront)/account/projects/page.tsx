import type { Metadata } from "next";
import { Camera, Images } from "lucide-react";

import { EmptyState } from "@/components/brand/empty-state";
import { AccountProjectCard } from "@/components/projects/account-project-card";
import { ProjectSubmitForm } from "@/components/projects/project-submit-form";
import { ButtonLink } from "@/components/ui/button-link";
import { requireUser } from "@/lib/auth-guards";
import { getProjectsForUser, getShareableProducts } from "@/lib/queries/customer-projects";

export const metadata: Metadata = {
  title: "Your projects",
  robots: { index: false, follow: false },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The customer's finished-project photos, and the form to share another.
 *
 * Everything on this page is read for the user `requireUser` returns — the
 * page takes no user id from anywhere else. `?product=` only preselects the
 * form, and only when it names a product in this customer's own list.
 */
export default async function ProjectsPage({ searchParams }: PageProps<"/account/projects">) {
  const user = await requireUser("/account/projects");
  const raw = await searchParams;

  const [projects, shareable] = await Promise.all([getProjectsForUser(user.id), getShareableProducts(user.id)]);

  const requested = first(raw.product);
  const initialProductId = shareable.find((product) => product.id === requested && product.remaining > 0)?.id;

  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-lg font-semibold text-foreground">Your projects</h2>
        <p className="text-body mt-1">
          Show what you made from your patterns. Every photo is reviewed, and photos are kept private for now.
        </p>
      </header>

      <section
        id="share"
        aria-labelledby="share-heading"
        className="scroll-mt-28 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6"
      >
        <h3 id="share-heading" className="mb-5 font-semibold text-foreground">
          Share a finished project
        </h3>

        {shareable.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={Camera}
            title="Nothing to share yet"
            description="You can share a project for any pattern you've bought. Once you buy one, it appears here."
            action={
              <ButtonLink href="/shop" variant="brand" size="pill">
                Browse patterns
              </ButtonLink>
            }
            className="py-6"
          />
        ) : (
          <ProjectSubmitForm products={shareable} initialProductId={initialProductId} />
        )}
      </section>

      <section aria-labelledby="projects-heading">
        <h3 id="projects-heading" className="mb-4 font-semibold text-foreground">
          Submitted projects
          {projects.length > 0 && <span className="text-body ml-2 font-normal">({projects.length})</span>}
        </h3>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <EmptyState
              variant="inline"
              icon={Images}
              title="No projects yet"
              description="Projects you share appear here with their review status."
            />
          </div>
        ) : (
          <ul className="space-y-4">
            {projects.map((project) => (
              <AccountProjectCard key={project.id} project={project} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
