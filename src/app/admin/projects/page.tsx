import type { Metadata } from "next";
import { Images } from "lucide-react";

import { AdminFilters } from "@/components/admin/admin-filters";
import { AdminPageHeader, AdminTableCard } from "@/components/admin/admin-page-header";
import { ProjectModerationTable } from "@/components/admin/project-moderation-table";
import { EmptyState } from "@/components/brand/empty-state";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { ButtonLink } from "@/components/ui/button-link";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { listAdminProjects, PROJECT_STATUSES } from "@/lib/queries/admin-projects";
import { buildBaseQuery, hasAnyParam } from "@/lib/shop-params";

export const metadata: Metadata = { title: "Projects" };

const LABELS: Record<ProjectStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  HIDDEN: "Hidden",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Narrows the untrusted `?status=` so a hand-edited URL cannot reach Prisma.
 * No value means the pending queue — the reason to open this page.
 */
function parseStatus(value: string | undefined): ProjectStatus | "ALL" {
  if (value === "ALL") return "ALL";
  return PROJECT_STATUSES.find((status) => status === value) ?? "PENDING";
}

export default async function AdminProjectsPage({ searchParams }: PageProps<"/admin/projects">) {
  const raw = await searchParams;
  const status = parseStatus(first(raw.status));

  const { projects, page, pageCount, statusCounts } = await listAdminProjects({
    status,
    q: first(raw.q),
    page: Number(first(raw.page)) || 1,
  });
  const everything = PROJECT_STATUSES.reduce((sum, key) => sum + statusCounts[key], 0);

  return (
    <div>
      <AdminPageHeader
        title="Projects"
        description="Finished-project photos from customers who bought the pattern. Approve, hide, or reject with a reason. Photos stay private — approved projects aren't shown on product pages yet."
      />

      <AdminFilters
        params={raw}
        searchPlaceholder="Search captions, makers or products…"
        selects={[
          {
            name: "status",
            // The select's empty value is the default view: the pending queue.
            label: `Pending (${statusCounts.PENDING})`,
            options: [
              { value: "ALL", label: `All statuses (${everything})` },
              ...(["APPROVED", "REJECTED", "HIDDEN"] as const).map((key) => ({
                value: key,
                label: `${LABELS[key]} (${statusCounts[key]})`,
              })),
            ],
          },
        ]}
      />

      {projects.length === 0 ? (
        <AdminTableCard>
          {hasAnyParam(raw, ["q", "status"]) ? (
            <EmptyState
              variant="inline"
              icon={Images}
              title="No projects match"
              description="Try a different search, or clear the filters to return to the pending queue."
              action={
                <ButtonLink href="/admin/projects" variant="brand" size="pill">
                  Clear filters
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              variant="inline"
              icon={Images}
              title="Nothing waiting for review"
              description="Projects customers share appear here, oldest first, until they are approved, hidden or rejected."
            />
          )}
        </AdminTableCard>
      ) : (
        <>
          <ProjectModerationTable projects={projects} />
          <PaginationNav page={page} pageCount={pageCount} baseQuery={buildBaseQuery(raw)} basePath="/admin/projects" />
        </>
      )}
    </div>
  );
}
