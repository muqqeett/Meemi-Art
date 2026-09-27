import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Plus } from "lucide-react";

import { AdminPageHeader, AdminTableCard } from "@/components/admin/admin-page-header";
import { EmptyState } from "@/components/brand/empty-state";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { publishTutorialAction, unpublishTutorialAction } from "@/lib/actions/admin/tutorial-forms";
import { listAdminTutorials } from "@/lib/queries/admin-tutorials";
import { TUTORIAL_PUBLISH_REQUIREMENTS } from "@/lib/validations/content";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tutorials" };

/**
 * Every tutorial, drafts first-class.
 *
 * Publish and unpublish are plain server forms here rather than in the editor,
 * so saving a draft can never publish it by accident. Each row shows the two
 * numbers the publish action checks — words and steps — so a refusal is never a
 * surprise.
 */
export default async function AdminTutorialsPage({ searchParams }: PageProps<"/admin/content/tutorials">) {
  const raw = await searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const statusParam = one(raw.status);
  const status = statusParam === "DRAFT" || statusParam === "PUBLISHED" ? statusParam : undefined;
  const error = one(raw.error);

  const { tutorials, page, pageCount, total, drafts, published } = await listAdminTutorials({
    page: Number(one(raw.page)) || 1,
    status,
  });

  const tab = (value: string | undefined, label: string) => {
    const active = status === value;
    const href = value ? `/admin/content/tutorials?status=${value}` : "/admin/content/tutorials";
    return (
      <Link
        key={label}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "inline-flex h-8 items-center rounded-md border px-3 text-[0.8125rem] transition-colors duration-150",
          active
            ? "border-brand-300 bg-brand-50 font-medium text-brand-700"
            : "border-border text-muted-foreground hover:border-brand-200 hover:text-foreground",
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <div>
      <AdminPageHeader
        title="Tutorials"
        description={`${published} published · ${drafts} ${drafts === 1 ? "draft" : "drafts"}. Drafts are invisible to readers, to search engines and to the sitemap.`}
        action={
          <ButtonLink href="/admin/content/tutorials/new" variant="brand" size="sm">
            <Plus aria-hidden />
            New tutorial
          </ButtonLink>
        }
      />

      {error && (
        <p role="status" className="mb-4 rounded-md border border-warning/25 bg-warning/8 px-4 py-3 text-sm text-foreground">
          {error}
        </p>
      )}

      <nav aria-label="Filter by status" className="mb-4 flex gap-1.5">
        {tab(undefined, `All (${total})`)}
        {tab("DRAFT", `Drafts (${drafts})`)}
        {tab("PUBLISHED", `Published (${published})`)}
      </nav>

      {tutorials.length === 0 ? (
        <AdminTableCard>
          <EmptyState
            variant="inline"
            icon={GraduationCap}
            title="No tutorials yet"
            description="Tutorials are written here and published when they are ready. Nothing is visible to readers until you publish it."
            action={
              <ButtonLink href="/admin/content/tutorials/new" variant="brand" size="pill">
                Write the first one
              </ButtonLink>
            }
          />
        </AdminTableCard>
      ) : (
        <>
          <AdminTableCard>
            <div className="w-full overflow-x-auto">
              <table className="admin-table admin-table-stack sm:min-w-[920px]">
                <caption className="sr-only">Tutorials, newest edit first</caption>
                <thead>
                  <tr>
                    <th scope="col">Tutorial</th>
                    <th scope="col">Status</th>
                    <th scope="col">Level</th>
                    <th scope="col" className="text-right">Words</th>
                    <th scope="col" className="text-right">Steps</th>
                    <th scope="col">Updated</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tutorials.map((tutorial) => {
                    const ready =
                      tutorial.words >= TUTORIAL_PUBLISH_REQUIREMENTS.minWords &&
                      tutorial.steps >= TUTORIAL_PUBLISH_REQUIREMENTS.minSteps;
                    return (
                      <tr key={tutorial.id}>
                        <td data-label="Tutorial">
                          <Link
                            href={`/admin/content/tutorials/${tutorial.id}/edit`}
                            className="block font-medium text-foreground hover:text-royal-600"
                          >
                            {tutorial.title}
                          </Link>
                          <span className="block truncate text-xs text-muted-foreground">
                            /tutorials/{tutorial.slug}
                            {tutorial.topic && ` · ${tutorial.topic}`}
                          </span>
                        </td>
                        <td data-label="Status">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                              tutorial.status === "PUBLISHED"
                                ? "border-success/20 bg-success/8 text-success"
                                : "border-border bg-[var(--admin-raised)] text-muted-foreground",
                            )}
                          >
                            {tutorial.status === "PUBLISHED" ? "Published" : "Draft"}
                          </span>
                        </td>
                        <td data-label="Level" className="text-muted-foreground">
                          {tutorial.difficulty.charAt(0) + tutorial.difficulty.slice(1).toLowerCase()}
                        </td>
                        <td data-label="Words" className="text-right tabular-nums text-muted-foreground">
                          {tutorial.words}
                        </td>
                        <td data-label="Steps" className="text-right tabular-nums text-muted-foreground">
                          {tutorial.steps}
                        </td>
                        <td data-label="Updated" className="text-muted-foreground">
                          <time dateTime={tutorial.updatedAt.toISOString()} className="tabular-nums">
                            {tutorial.updatedAt.toLocaleDateString("en-US", { dateStyle: "medium" })}
                          </time>
                        </td>
                        <td data-label="Actions">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <ButtonLink
                              href={`/admin/content/tutorials/${tutorial.id}/preview`}
                              variant="outline"
                              size="sm"
                            >
                              Preview
                            </ButtonLink>
                            {tutorial.status === "PUBLISHED" ? (
                              <>
                                <ButtonLink href={`/tutorials/${tutorial.slug}`} variant="ghost" size="sm">
                                  View
                                </ButtonLink>
                                <form action={unpublishTutorialAction}>
                                  <input type="hidden" name="id" value={tutorial.id} />
                                  <Button type="submit" variant="ghost" size="sm">
                                    Unpublish
                                  </Button>
                                </form>
                              </>
                            ) : (
                              <form action={publishTutorialAction}>
                                <input type="hidden" name="id" value={tutorial.id} />
                                <Button type="submit" variant="outline" size="sm" disabled={!ready}>
                                  Publish
                                </Button>
                              </form>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AdminTableCard>

          <PaginationNav
            page={page}
            pageCount={pageCount}
            baseQuery={status ? `status=${status}` : ""}
            basePath="/admin/content/tutorials"
          />
        </>
      )}
    </div>
  );
}
