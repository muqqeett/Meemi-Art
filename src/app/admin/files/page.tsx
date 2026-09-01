import type { Metadata } from "next";
import Link from "next/link";
import { FileDown, ShieldCheck } from "lucide-react";

import { AdminPageHeader, AdminTableCard } from "@/components/admin/admin-page-header";
import { StatusBadge } from "@/components/admin/admin-primitives";
import { EmptyState } from "@/components/brand/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { listAdminFiles } from "@/lib/queries/admin-resources";
import { buildBaseQuery } from "@/lib/shop-params";
import { formatBytes } from "@/lib/format-bytes";
import { formatLabel } from "@/lib/file-format";

export const metadata: Metadata = { title: "Digital Files" };

/**
 * The sellable files.
 *
 * `storageKey` is never selected into this page — it is the value that would
 * let someone sign their own download URL, and a list of filenames has no use
 * for it. Files are reached for editing through their product, where the
 * existing upload flow already lives; this page does not introduce a second one.
 *
 * Download counts are the real `DigitalAccess.downloadCount` totals, not a
 * stand-in.
 */
export default async function AdminFilesPage({ searchParams }: PageProps<"/admin/files">) {
  const raw = await searchParams;
  const { assets, total, page, pageCount } = await listAdminFiles({
    page: Number(raw.page) || 1,
  });

  return (
    <div>
      <AdminPageHeader
        title="Digital files"
        description={`${total.toLocaleString("en-US")} ${total === 1 ? "asset" : "assets"} stored privately and delivered through signed, expiring links.`}
      />

      {assets.length === 0 ? (
        <AdminTableCard>
          <EmptyState
            variant="inline"
            icon={FileDown}
            title="No digital files yet"
            description="A product needs a file attached before it can be delivered. Upload one from the product editor."
            action={
              <ButtonLink href="/admin/products" variant="brand" size="pill">
                Go to products
              </ButtonLink>
            }
          />
        </AdminTableCard>
      ) : (
        <>
          <AdminTableCard>
            <table className="w-full min-w-[880px] text-sm">
              <caption className="sr-only">Digital files</caption>
              <thead className="bg-surface-alt text-left">
                <tr className="text-xs tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="px-4 py-3 font-medium">
                    File
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Size
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Downloads
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Storage
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Updated
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-surface-alt/60">
                    <td className="max-w-72 px-4 py-3">
                      <span className="block truncate font-medium text-foreground">
                        {asset.filename}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatLabel(asset.contentType, asset.filename)}
                        {asset.version ? ` · v${asset.version}` : ""}
                      </span>
                    </td>

                    <td className="max-w-64 px-4 py-3">
                      {asset.product ? (
                        <Link
                          href={`/admin/products/${asset.product.id}/edit`}
                          className="block truncate font-medium text-foreground hover:text-royal-600"
                        >
                          {asset.product.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Not attached</span>
                      )}
                    </td>

                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {formatBytes(asset.bytes)}
                    </td>

                    <td className="px-4 py-3 tabular-nums">
                      <span className="font-medium text-foreground">{asset.downloads}</span>
                      <span className="block text-xs text-muted-foreground">
                        across {asset.grants} {asset.grants === 1 ? "grant" : "grants"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {/* Not a database column — a statement of how these files
                          are stored, which is true of every one of them:
                          Cloudinary `type: private`, reachable only through a
                          signed URL the download route mints per request. */}
                      <StatusBadge tone="positive">
                        <ShieldCheck className="size-3" aria-hidden />
                        Private
                      </StatusBadge>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      <time dateTime={asset.updatedAt.toISOString()}>
                        {asset.updatedAt.toLocaleDateString("en-US", { dateStyle: "medium" })}
                      </time>
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
            basePath="/admin/files"
          />
        </>
      )}
    </div>
  );
}
