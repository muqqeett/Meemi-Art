import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CategoryManager, type AdminCategory } from "@/components/admin/category-manager";
import { listAdminCategories } from "@/lib/queries/admin";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  const categories = await listAdminCategories();

  return (
    <div>
      <AdminPageHeader
        title="Categories"
        description="Organise the catalogue. Categories appear in the shop nav and on the homepage."
      />
      <CategoryManager categories={categories as AdminCategory[]} />
    </div>
  );
}
