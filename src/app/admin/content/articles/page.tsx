import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper, Plus } from "lucide-react";

import { AdminPageHeader, AdminTableCard } from "@/components/admin/admin-page-header";
import { EmptyState } from "@/components/brand/empty-state";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { publishArticleAction, unpublishArticleAction } from "@/lib/actions/admin/article-forms";
import { listAdminArticles } from "@/lib/queries/admin-articles";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Articles" };

/**
 * Every article, drafts first-class.
 *
 * Publish and unpublish are plain server forms here rather than in the editor,
 * so saving a draft can never publish it by accident. Each row shows the two
 * numbers that decide whether a piece is ready — words and sections — because
 * the publish action refuses anything below the floor.
 */
export default async function AdminArticlesPage({ searchParams }: PageProps<"/admin/content/articles">) {
  const raw = await searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const statusParam = one(raw.status);
  const status = statusParam === "DRAFT" || statusParam === "PUBLISHED" ? statusParam : undefined;

  const { articles, page, pageCount, total, drafts, published } = await listAdminArticles({
    page: Number(one(raw.page)) || 1,
    status,
  });

  const tab = (value: string | undefined, label: string) => {
    const active = status === value;
    const href = value ? `/admin/content/articles?status=${value}` : "/admin/content/articles";
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
        title="Articles"
        description={`${published} published · ${drafts} ${drafts === 1 ? "draft" : "drafts"}. Drafts are invisible to readers, to search engines and to the sitemap.`}
        action={
          <ButtonLink href="/admin/content/articles/new" variant="brand" size="sm">
            <Plus aria-hidden />
            New article
          </ButtonLink>
        }
      />

      <nav aria-label="Filter by status" className="mb-4 flex gap-1.5">
        {tab(undefined, `All (${total})`)}
        {tab("DRAFT", `Drafts (${drafts})`)}
        {tab("PUBLISHED", `Published (${published})`)}
      </nav>

      {articles.length === 0 ? (
        <AdminTableCard>
          <EmptyState
            variant="inline"
            icon={Newspaper}
            title="No articles yet"
            description="Articles are written here and published when they are ready. Nothing is visible to readers until you publish it."
            action={
              <ButtonLink href="/admin/content/articles/new" variant="brand" size="pill">
                Write the first one
              </ButtonLink>
            }
          />
        </AdminTableCard>
      ) : (
        <>
          <AdminTableCard>
            <div className="w-full overflow-x-auto">
              <table className="admin-table admin-table-stack sm:min-w-[880px]">
                <caption className="sr-only">Articles, newest edit first</caption>
                <thead>
                  <tr>
                    <th scope="col">Article</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-right">Words</th>
                    <th scope="col" className="text-right">Read</th>
                    <th scope="col">Updated</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {articles.map((article) => (
                    <tr key={article.id}>
                      <td data-label="Article">
                        <Link
                          href={`/admin/content/articles/${article.id}/edit`}
                          className="block font-medium text-foreground hover:text-royal-600"
                        >
                          {article.title}
                        </Link>
                        <span className="block truncate text-xs text-muted-foreground">
                          /blog/{article.slug}
                          {article.topic && ` · ${article.topic}`}
                        </span>
                      </td>
                      <td data-label="Status">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            article.status === "PUBLISHED"
                              ? "border-success/20 bg-success/8 text-success"
                              : "border-border bg-[var(--admin-raised)] text-muted-foreground",
                          )}
                        >
                          {article.status === "PUBLISHED" ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td data-label="Words" className="text-right tabular-nums text-muted-foreground">
                        {article.words}
                      </td>
                      <td data-label="Read" className="text-right tabular-nums text-muted-foreground">
                        {article.readingMinutes} min
                      </td>
                      <td data-label="Updated" className="text-muted-foreground">
                        <time dateTime={article.updatedAt.toISOString()} className="tabular-nums">
                          {article.updatedAt.toLocaleDateString("en-US", { dateStyle: "medium" })}
                        </time>
                      </td>
                      <td data-label="Actions">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <ButtonLink href={`/admin/content/articles/${article.id}/preview`} variant="outline" size="sm">
                            Preview
                          </ButtonLink>
                          {article.status === "PUBLISHED" ? (
                            <>
                              <ButtonLink href={`/blog/${article.slug}`} variant="ghost" size="sm">
                                View
                              </ButtonLink>
                              <form action={unpublishArticleAction}>
                                <input type="hidden" name="id" value={article.id} />
                                <Button type="submit" variant="ghost" size="sm">
                                  Unpublish
                                </Button>
                              </form>
                            </>
                          ) : (
                            <form action={publishArticleAction}>
                              <input type="hidden" name="id" value={article.id} />
                              <Button type="submit" variant="outline" size="sm">
                                Publish
                              </Button>
                            </form>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminTableCard>

          <PaginationNav
            page={page}
            pageCount={pageCount}
            baseQuery={status ? `status=${status}` : ""}
            basePath="/admin/content/articles"
          />
        </>
      )}
    </div>
  );
}
