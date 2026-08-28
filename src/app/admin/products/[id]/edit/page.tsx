import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProductForm } from "@/components/admin/product-form";
import { getAdminProduct } from "@/lib/queries/admin";
import { getAllCategories } from "@/lib/queries/categories";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
}: PageProps<"/admin/products/[id]/edit">) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    getAdminProduct(id),
    getAllCategories(),
  ]);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin/products"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-brand-600"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to products
      </Link>

      <AdminPageHeader
        title={product.name}
        description={`SKU ${product.sku}`}
        action={
          <Link
            href={`/products/${product.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
          >
            View in shop
            <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        }
      />

      <ProductForm
        categories={categories}
        productId={product.id}
        defaultValues={{
          name: product.name,
          slug: product.slug,
          brand: product.brand,
          sku: product.sku,
          description: product.description,
          shortDescription: product.shortDescription ?? "",
          categoryId: product.categoryId,
          priceCents: product.priceCents,
          compareAtCents: product.compareAtCents,
          fileVersion: product.asset?.version ?? "",
          seoTitle: product.seoTitle ?? "",
          seoDescription: product.seoDescription ?? "",
          featured: product.featured,
          isActive: product.isActive,
          images: product.images.map((image) => ({
            url: image.url,
            alt: image.alt,
            // Carried through the form so a re-save preserves ownership, and
            // so removing an image can reclaim the object it owns.
            key: image.storageKey,
          })),
        }}
      asset={product.asset}
      />
    </div>
  );
}
