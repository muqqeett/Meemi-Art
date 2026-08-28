import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProductForm } from "@/components/admin/product-form";
import { getAllCategories } from "@/lib/queries/categories";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const categories = await getAllCategories();

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader
        title="New product"
        description="Add a product, its images, and every size and colour you plan to sell."
      />
      <ProductForm categories={categories} />
    </div>
  );
}
