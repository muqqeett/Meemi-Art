import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Plus, Package } from "lucide-react";

import { AdminPageHeader, AdminTableCard } from "@/components/admin/admin-page-header";
import { AdminFilters } from "@/components/admin/admin-filters";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { EmptyState } from "@/components/brand/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { listAdminProducts } from "@/lib/queries/admin";
import { getAllCategories } from "@/lib/queries/categories";
import { formatBytes } from "@/lib/format-bytes";
import { buildBaseQuery, hasAnyParam } from "@/lib/shop-params";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Products" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminProductsPage({
  searchParams,
}: PageProps<"/admin/products">) {
  const raw = await searchParams;

  const fileState = first(raw.fileState);
  const status = first(raw.status);
  const filtered = hasAnyParam(raw, ["q", "categoryId", "fileState", "status"]);

  const [{ products, total, page, pageCount }, categories] = await Promise.all([
    listAdminProducts({
      q: first(raw.q),
      categoryId: first(raw.categoryId),
      fileState: fileState === "unsellable" ? fileState : undefined,
      status: status === "active" || status === "inactive" ? status : undefined,
      page: Number(first(raw.page)) || 1,
    }),
    getAllCategories(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Products"
        description={`${total} ${total === 1 ? "product" : "products"} in the catalogue`}
        action={
          <ButtonLink href="/admin/products/new" variant="brand" size="pill">
            <Plus aria-hidden />
            New product
          </ButtonLink>
        }
      />

      <AdminFilters
        params={raw}
        searchPlaceholder="Search by name, SKU or brand…"
        selects={[
          {
            name: "categoryId",
            label: "All categories",
            options: categories.map((category) => ({
              value: category.id,
              label: category.name,
            })),
          },
          {
            name: "status",
            label: "All statuses",
            options: [
              { value: "active", label: "Published" },
              { value: "inactive", label: "Hidden" },
            ],
          },
          {
            name: "fileState",
            label: "Any file state",
            options: [{ value: "unsellable", label: "Missing file" }],
          },
        ]}
      />

      {products.length === 0 ? (
        <AdminTableCard>
          {filtered ? (
            <EmptyState
              icon={Package}
              title="No products match"
              description="Try a different search, or clear the filters to see the whole catalogue."
              action={
                <ButtonLink href="/admin/products" variant="brand" size="pill">
                  Clear filters
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              icon={Package}
              title="No products yet"
              description="Add your first piece and it will appear here and on the storefront."
              action={
                <ButtonLink href="/admin/products/new" variant="brand" size="pill">
                  <Plus aria-hidden />
                  New product
                </ButtonLink>
              }
            />
          )}
        </AdminTableCard>
      ) : (
        <>
          <AdminTableCard>
            <table className="w-full min-w-[860px] text-sm">
              <caption className="sr-only">Product catalogue</caption>
              <thead className="bg-surface-alt text-left">
                <tr className="text-xs tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Price
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    File
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-surface-alt/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-surface-alt">
                          {product.images[0]?.url && (
                            <Image
                              src={product.images[0].url}
                              alt=""
                              fill
                              sizes="44px"
                              className="object-cover"
                            />
                          )}
                        </span>
                        <span className="min-w-0">
                          <Link
                            href={`/admin/products/${product.id}/edit`}
                            className="block truncate font-medium text-foreground hover:text-brand-600"
                          >
                            {product.name}
                          </Link>
                          <span className="block font-mono text-xs text-muted-foreground">
                            {product.sku} · {product.asset?.version ? `v${product.asset.version}` : "—"}</span>
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">
                      {product.category.name}
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-medium tabular-nums">
                        {formatMoney(product.priceCents)}
                      </span>
                      {product.compareAtCents && (
                        <span className="ml-1.5 text-xs text-muted-foreground line-through">
                          {formatMoney(product.compareAtCents)}
                        </span>
                      )}
                    </td>

                    {/* Replaces the old stock column. A file cannot run low,
                        but it can be missing — and a published product with no
                        file is the one state that costs a customer money for
                        nothing. */}
                    <td className="px-4 py-3">
                      {product.hasFile ? (
                        <span className="text-xs text-muted-foreground">
                          {product.asset ? formatBytes(product.asset.bytes) : "—"}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-destructive">
                          No file
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                          product.isActive
                            ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                            : "bg-slate-100 text-slate-700 ring-slate-200",
                        )}
                      >
                        {product.isActive ? "Published" : "Hidden"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <ProductRowActions product={product} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableCard>

          <PaginationNav
            page={page}
            pageCount={pageCount}
            baseQuery={buildBaseQuery(raw)}
            basePath="/admin/products"
          />
        </>
      )}
    </div>
  );
}
