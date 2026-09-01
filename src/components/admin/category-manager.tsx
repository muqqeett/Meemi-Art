"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, AlertCircle, FolderTree } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  controlInput,
  controlSelect,
  controlTextarea,
} from "@/components/admin/admin-form";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/brand/empty-state";
import { AdminTableCard } from "@/components/admin/admin-page-header";
import { saveCategory, deleteCategory } from "@/lib/actions/admin/catalog";
import { cn } from "@/lib/utils";

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  _count: { products: number; children: number };
};

/** Lucide icon names the storefront category grid knows how to render. */
const ICON_CHOICES = ["Shirt", "Sparkles", "Watch", "Users", "Tag"];

function CategoryForm({
  category,
  categories,
  onDone,
}: {
  category: AdminCategory | null;
  categories: AdminCategory[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveCategory, null);

  useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message ?? "Saved.");
    router.refresh();
    onDone();
  }, [state, router, onDone]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {category && <input type="hidden" name="categoryId" value={category.id} />}

      {state && !state.ok && !state.fieldErrors && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="c-name">Name</Label>
          <Input
            id="c-name"
            name="name"
            defaultValue={category?.name ?? ""}
            aria-invalid={Boolean(errors?.name)}
            className={controlInput}
          />
          {errors?.name && (
            <p role="alert" className="text-sm text-destructive">
              {errors.name}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-slug">Slug</Label>
          <Input
            id="c-slug"
            name="slug"
            defaultValue={category?.slug ?? ""}
            aria-invalid={Boolean(errors?.slug)}
            className={cn(controlInput, "font-mono")}
          />
          {errors?.slug && (
            <p role="alert" className="text-sm text-destructive">
              {errors.slug}
            </p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="c-description">Description</Label>
          <textarea
            id="c-description"
            name="description"
            rows={3}
            defaultValue={category?.description ?? ""}
            className={controlTextarea}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="c-image">Image URL</Label>
          <Input
            id="c-image"
            name="image"
            defaultValue={category?.image ?? ""}
            placeholder="https://…"
            className={controlInput}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-icon">Icon</Label>
          <select
            id="c-icon"
            name="icon"
            defaultValue={category?.icon ?? ""}
            className={controlSelect}
          >
            <option value="">No icon</option>
            {ICON_CHOICES.map((icon) => (
              <option key={icon} value={icon}>
                {icon}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-parent">Parent category</Label>
          <select
            id="c-parent"
            name="parentId"
            defaultValue={category?.parentId ?? ""}
            className={controlSelect}
          >
            <option value="">Top level</option>
            {categories
              .filter((option) => option.id !== category?.id)
              .map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-sort">Sort order</Label>
          <Input
            id="c-sort"
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={category?.sortOrder ?? 0}
            className={controlInput}
          />
        </div>

        <div className="flex items-end gap-2.5 pb-2">
          <Checkbox
            id="c-active"
            name="isActive"
            defaultChecked={category?.isActive ?? true}
            value="true"
          />
          <Label htmlFor="c-active" className="cursor-pointer font-normal">
            Active
          </Label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="pill" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="brand" size="pill" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {category ? "Save changes" : "Create category"}
        </Button>
      </div>
    </form>
  );
}

export function CategoryManager({ categories }: { categories: AdminCategory[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [pending, startTransition] = useTransition();

  const closeDialog = useCallback(() => setOpen(false), []);

  function remove(category: AdminCategory) {
    startTransition(async () => {
      const result = await deleteCategory(category.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Category deleted.");
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          variant="brand"
          size="pill"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus aria-hidden />
          New category
        </Button>
      </div>

      {categories.length === 0 ? (
        <AdminTableCard>
          <EmptyState
            icon={FolderTree}
            title="No categories yet"
            description="Categories organise the shop and power the homepage grid."
            action={
              <Button
                variant="brand"
                size="pill"
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus aria-hidden />
                Create the first one
              </Button>
            }
          />
        </AdminTableCard>
      ) : (
        <AdminTableCard>
          <table className="admin-table admin-table-stack sm:min-w-[640px]">
            <caption className="sr-only">Product categories</caption>
            <thead>
              <tr>
                <th scope="col">
                  Category
                </th>
                <th scope="col">
                  Parent
                </th>
                <th scope="col" className="text-right">
                  Products
                </th>
                <th scope="col">
                  Status
                </th>
                <th scope="col" className="text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td data-label="Category">
                    <span className="block font-medium text-foreground">
                      {category.name}
                    </span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      /{category.slug}
                    </span>
                  </td>
                  <td data-label="Slug" className="text-muted-foreground">
                    {category.parent?.name ?? "—"}
                  </td>
                  <td data-label="Products" className="text-right tabular-nums">
                    {category._count.products}
                  </td>
                  <td data-label="Status">
                    <span
                      className={
                        category.isActive
                          ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200 ring-inset"
                          : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 ring-inset"
                      }
                    >
                      {category.isActive ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        onClick={() => {
                          setEditing(category);
                          setOpen(true);
                        }}
                        aria-label={`Edit ${category.name}`}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => remove(category)}
                        disabled={pending}
                        aria-label={`Delete ${category.name}`}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableCard>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
            <DialogDescription>
              Categories drive shop navigation, the homepage grid and product filters.
            </DialogDescription>
          </DialogHeader>

          <CategoryForm
            key={editing?.id ?? "new"}
            category={editing}
            categories={categories}
            onDone={closeDialog}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
