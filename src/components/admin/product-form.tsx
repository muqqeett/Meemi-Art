"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ProductImageManager } from "@/components/admin/product-image-manager";
import {
  DigitalFileField,
  type DigitalAssetSummary,
} from "@/components/admin/digital-file-field";
import {
  productSchema,
  type ProductInput,
  type ProductFormValues,
} from "@/lib/validations/admin";
import { createProduct, updateProduct } from "@/lib/actions/admin/products";
import { siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

type ProductFormProps = {
  categories: { id: string; name: string }[];
  /** Present when editing; omitted when creating. */
  productId?: string;
  defaultValues?: Partial<ProductFormValues>;
  /** The product's current file, when it has one. */
  asset?: DigitalAssetSummary;
};

const EMPTY: ProductFormValues = {
  name: "",
  slug: "",
  brand: siteConfig.name,
  sku: "",
  description: "",
  shortDescription: "",
  categoryId: "",
  priceCents: 0,
  compareAtCents: null,
  fileVersion: "",
  seoTitle: "",
  seoDescription: "",
  featured: false,
  isActive: true,
  images: [],
};

/**
 * Cents come in as `unknown` from the schema's input type (they are coerced on
 * parse), so normalise before formatting for the dollar-denominated inputs.
 */
function centsToDollars(cents: unknown): string {
  const value = Number(cents);
  if (!Number.isFinite(value) || value <= 0) return "";
  return (value / 100).toFixed(2);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description && <p className="text-body mt-1">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * Create/edit form for a digital product and its preview images.
 *
 * Prices are captured in dollars for the person typing and converted to integer
 * cents on submit, which is the only unit the server and database deal in.
 */
export function ProductForm({
  categories,
  productId,
  defaultValues,
  asset = null,
}: ProductFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormValues, unknown, ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
  });

  // Images are managed as a whole array by `ProductImageManager` (upload,
  // reorder, replace), so they are read via `watch` and written with
  // `setValue` rather than through a field array.

  // Registered separately so the slug auto-fill can wrap RHF's own onBlur.
  const nameField = register("name");

  const watchedImages = watch("images");

  function onSubmit(values: ProductInput) {
    setFormError(null);

    startTransition(async () => {
      const result = productId
        ? await updateProduct(productId, values)
        : await createProduct(values);

      if (!result.ok) {
        setFormError(result.error);
        // Surface field errors the client schema couldn't catch (uniqueness).
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          toast.error(`${field}: ${message}`);
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      toast.success(result.message ?? "Saved.");
      router.push("/admin/products");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{formError}</span>
        </div>
      )}

      <Section title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="p-name">Product name</Label>
            <Input
              id="p-name"
              {...nameField}
              onBlur={(event) => {
                // Compose rather than replace: dropping RHF's own onBlur would
                // stop touched-state and validation from updating.
                void nameField.onBlur(event);
                // Auto-fill the slug from the name, but never overwrite an
                // existing slug — changing it would break live URLs.
                if (!watch("slug")) {
                  setValue("slug", slugify(event.target.value), { shouldValidate: true });
                }
              }}
              aria-invalid={Boolean(errors.name)}
              className="h-11"
            />
            {errors.name && (
              <p role="alert" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-slug">URL slug</Label>
            <Input id="p-slug" {...register("slug")} className="h-11 font-mono text-sm" />
            <p className="text-xs text-muted-foreground">/products/{watch("slug") || "…"}</p>
            {errors.slug && (
              <p role="alert" className="text-sm text-destructive">
                {errors.slug.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-sku">Base SKU</Label>
            <Input id="p-sku" {...register("sku")} className="h-11 font-mono text-sm" />
            {errors.sku && (
              <p role="alert" className="text-sm text-destructive">
                {errors.sku.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-brand">Brand</Label>
            <Input id="p-brand" {...register("brand")} className="h-11" />
            {errors.brand && (
              <p role="alert" className="text-sm text-destructive">
                {errors.brand.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-category">Category</Label>
            <select
              id="p-category"
              {...register("categoryId")}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <option value="">Choose a category…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p role="alert" className="text-sm text-destructive">
                {errors.categoryId.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="p-short">Short description</Label>
            <Input
              id="p-short"
              {...register("shortDescription")}
              placeholder="One line shown on product cards"
              className="h-11"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="p-description">Full description</Label>
            <textarea
              id="p-description"
              {...register("description")}
              rows={6}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            />
            {errors.description && (
              <p role="alert" className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

        </div>
      </Section>

      <Section title="Pricing" description="Entered in dollars; stored as integer cents.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="p-price">Price</Label>
            <div className="relative">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="p-price"
                inputMode="decimal"
                defaultValue={centsToDollars(defaultValues?.priceCents)}
                onChange={(event) =>
                  setValue("priceCents", Math.round(Number(event.target.value || 0) * 100), {
                    shouldValidate: true,
                  })
                }
                className="h-11 pl-7"
              />
            </div>
            {errors.priceCents && (
              <p role="alert" className="text-sm text-destructive">
                {errors.priceCents.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-compare">Compare-at price (optional)</Label>
            <div className="relative">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="p-compare"
                inputMode="decimal"
                defaultValue={centsToDollars(defaultValues?.compareAtCents)}
                onChange={(event) => {
                  const raw = event.target.value;
                  setValue(
                    "compareAtCents",
                    raw ? Math.round(Number(raw) * 100) : null,
                    { shouldValidate: true },
                  );
                }}
                className="h-11 pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Shown struck through. Must be higher than the price.
            </p>
            {errors.compareAtCents && (
              <p role="alert" className="text-sm text-destructive">
                {errors.compareAtCents.message}
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section
        title="Photography"
        description="Upload your own photos. The first image is the primary one — it appears on cards, in search results and in link previews."
      >
        <ProductImageManager
          images={(watchedImages ?? []).map((image) => ({
            url: image?.url ?? "",
            alt: image?.alt ?? "",
            key: image?.key ?? null,
          }))}
          onChange={(next) =>
            setValue("images", next, { shouldValidate: true, shouldDirty: true })
          }
          error={errors.images?.message ?? errors.images?.root?.message}
        />
      </Section>

      <Section
        title="Search engine listing"
        description="Optional. Left blank, these are generated from the product name, category and description."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-seo-title">SEO title</Label>
            <Input
              id="p-seo-title"
              {...register("seoTitle")}
              placeholder={`${watch("name") || "Product name"} | ${siteConfig.name}`}
              className="h-11"
              maxLength={70}
            />
            <p className="text-xs text-muted-foreground">
              {(watch("seoTitle") ?? "").length}/70 characters
            </p>
            {errors.seoTitle && (
              <p role="alert" className="text-sm text-destructive">
                {errors.seoTitle.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-seo-description">SEO description</Label>
            <textarea
              id="p-seo-description"
              {...register("seoDescription")}
              rows={3}
              maxLength={180}
              placeholder="A short summary shown under the title in search results."
              className="w-full border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
            />
            <p className="text-xs text-muted-foreground">
              {(watch("seoDescription") ?? "").length}/180 characters
            </p>
            {errors.seoDescription && (
              <p role="alert" className="text-sm text-destructive">
                {errors.seoDescription.message}
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section
        title="Digital file"
        description="The file the customer downloads after paying. A product cannot be published without one."
      >
        <DigitalFileField productId={productId ?? null} asset={asset} />
      </Section>

      <Section
        title="Version"
        description="Optional. Shown to buyers beside the file, so they can tell editions apart."
      >
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="p-version">Version label</Label>
          <Input
            id="p-version"
            {...register("fileVersion")}
            placeholder="1.2"
            className="h-11"
          />
        </div>
      </Section>

      <Section title="Visibility">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="p-active"
              checked={watch("isActive")}
              onCheckedChange={(checked) => setValue("isActive", checked === true)}
            />
            <Label htmlFor="p-active" className="cursor-pointer font-normal">
              Published — visible in the shop
            </Label>
          </div>

          <div className="flex items-center gap-2.5">
            <Checkbox
              id="p-featured"
              checked={watch("featured")}
              onCheckedChange={(checked) => setValue("featured", checked === true)}
            />
            <Label htmlFor="p-featured" className="cursor-pointer font-normal">
              Featured — shown in Product Highlights on the homepage
            </Label>
          </div>
        </div>
      </Section>

      <div
        className={cn(
          "sticky bottom-0 flex flex-wrap items-center justify-end gap-3",
          "border-t border-border bg-background/95 py-4 backdrop-blur",
        )}
      >
        <ButtonLink href="/admin/products" variant="outline" size="pill">
          Cancel
        </ButtonLink>
        <Button type="submit" variant="brand" size="pill" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {productId ? "Save changes" : "Create product"}
        </Button>
      </div>
    </form>
  );
}
