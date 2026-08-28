"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Star, Eye, EyeOff, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  deleteProduct,
  duplicateProduct,
  toggleProductFlag,
} from "@/lib/actions/admin/products";
import { cn } from "@/lib/utils";

export function ProductRowActions({
  product,
}: {
  product: { id: string; name: string; featured: boolean; isActive: boolean };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function toggle(field: "featured" | "isActive", value: boolean) {
    startTransition(async () => {
      const result = await toggleProductFlag(product.id, field, value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        field === "featured"
          ? value
            ? "Marked as featured"
            : "Removed from featured"
          : value
            ? "Product published"
            : "Product hidden",
      );
      router.refresh();
    });
  }

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateProduct(product.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Product duplicated.");
      // Drop the admin straight into the copy — the point of duplicating is to
      // edit the differences.
      if (result.data) {
        router.push(`/admin/products/${result.data.id}/edit`);
      }
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteProduct(product.id);
      setConfirmOpen(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Product deleted.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-lg"
        onClick={() => toggle("featured", !product.featured)}
        disabled={pending}
        aria-pressed={product.featured}
        aria-label={
          product.featured
            ? `Remove ${product.name} from featured`
            : `Mark ${product.name} as featured`
        }
        title={product.featured ? "Featured" : "Not featured"}
      >
        <Star
          className={cn(product.featured && "fill-star text-star")}
          aria-hidden
        />
      </Button>

      <Button
        variant="ghost"
        size="icon-lg"
        onClick={() => toggle("isActive", !product.isActive)}
        disabled={pending}
        aria-pressed={product.isActive}
        aria-label={
          product.isActive ? `Hide ${product.name}` : `Publish ${product.name}`
        }
        title={product.isActive ? "Visible in shop" : "Hidden"}
      >
        {product.isActive ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
      </Button>

      <Button
        variant="ghost"
        size="icon-lg"
        nativeButton={false}
        render={<Link href={`/admin/products/${product.id}/edit`} />}
        aria-label={`Edit ${product.name}`}
        title="Edit"
      >
        <Pencil aria-hidden />
      </Button>

      <Button
        variant="ghost"
        size="icon-lg"
        onClick={duplicate}
        disabled={pending}
        aria-label={`Duplicate ${product.name}`}
        title="Duplicate as draft"
      >
        <Copy aria-hidden />
      </Button>

      <Button
        variant="ghost"
        size="icon-lg"
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
        aria-label={`Delete ${product.name}`}
        title="Delete"
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 aria-hidden />
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{product.name}”?</DialogTitle>
            <DialogDescription>
              This can&apos;t be undone. If the product appears in any past order it will
              be archived instead of deleted, so order history stays intact.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" size="pill" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="pill"
              onClick={remove}
              disabled={pending}
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Delete product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
