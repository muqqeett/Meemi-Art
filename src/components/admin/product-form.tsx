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
import { Checkbox } from "@/components/ui/checkbox";
import { ProductImageManager } from "@/components/admin/product-image-manager";
import {
  Field,
  FormActions,
  FormGrid,
  FormSection,
  ToggleRow,
  controlInput,
  controlSelect,
  controlTextarea,
  describedBy,
} from "@/components/admin/admin-form";
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
import {
  PaddleConnectionField,
  type PaddleConnection,
} from "@/components/admin/paddle-connection-field";
import { siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

type ProductFormProps = {
  categories: { id: string; name: string }[];
  /** Present when editing; omitted when creating. */
  productId?: string;
  defaultValues?: Partial<ProductFormValues>;
  /** The product's current file, when it has one. */
  asset?: DigitalAssetSummary;
  /** Paddle catalogue link, when editing an existing product. */
  paddle?: PaddleConnection | null;
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

/**
 * Create/edit form for a digital product and its preview images.
 *
 * Prices are captured in dollars for the person typing and converted to integer
 * cents on submit, which is the only unit the server and database deal in.
 *
 * Laid out as one ruled surface with a label column rather than nine stacked
 * cards, so the sections read as parts of a single record. The action bar
 * sticks: nine sections is a long scroll, and Save should never be somewhere
 * you have to go looking for.
 */
export function ProductForm({
  categories,
  productId,
  defaultValues,
  asset = null,
  paddle = null,
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

  const seoTitleLength = (watch("seoTitle") ?? "").length;
  const seoDescriptionLength = (watch("seoDescription") ?? "").length;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-md border border-destructive/25 bg-destructive/[0.05] px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{formError}</span>
        </div>
      )}

      <div className="admin-card overflow-hidden">
        <FormSection
          title="Basics"
          description="What the product is called and where it lives in the shop."
        >
          <FormGrid>
            <Field
              id="p-name"
              label="Product name"
              required
              error={errors.name?.message}
              className="sm:col-span-2"
            >
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
                aria-describedby={describedBy("p-name", { error: errors.name })}
                className={controlInput}
              />
            </Field>

            <Field
              id="p-slug"
              label="URL slug"
              hint={
                <>
                  <span className="text-muted-foreground/70">/products/</span>
                  <span className="font-mono text-foreground">{watch("slug") || "…"}</span>
                </>
              }
              error={errors.slug?.message}
            >
              <Input
                id="p-slug"
                {...register("slug")}
                aria-invalid={Boolean(errors.slug)}
                aria-describedby={describedBy("p-slug", { hint: true, error: errors.slug })}
                className={cn(controlInput, "font-mono")}
              />
            </Field>

            <Field id="p-sku" label="Base SKU" error={errors.sku?.message}>
              <Input
                id="p-sku"
                {...register("sku")}
                aria-invalid={Boolean(errors.sku)}
                aria-describedby={describedBy("p-sku", { error: errors.sku })}
                className={cn(controlInput, "font-mono")}
              />
            </Field>

            <Field id="p-brand" label="Brand" error={errors.brand?.message}>
              <Input
                id="p-brand"
                {...register("brand")}
                aria-invalid={Boolean(errors.brand)}
                aria-describedby={describedBy("p-brand", { error: errors.brand })}
                className={controlInput}
              />
            </Field>

            <Field id="p-category" label="Category" required error={errors.categoryId?.message}>
              <select
                id="p-category"
                {...register("categoryId")}
                aria-invalid={Boolean(errors.categoryId)}
                aria-describedby={describedBy("p-category", { error: errors.categoryId })}
                className={controlSelect}
              >
                <option value="">Choose a category…</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              id="p-short"
              label="Short description"
              hint="One line shown on product cards."
              className="sm:col-span-2"
            >
              <Input
                id="p-short"
                {...register("shortDescription")}
                placeholder="One line shown on product cards"
                aria-describedby={describedBy("p-short", { hint: true })}
                className={controlInput}
              />
            </Field>

            <Field
              id="p-description"
              label="Full description"
              required
              error={errors.description?.message}
              className="sm:col-span-2"
            >
              <textarea
                id="p-description"
                {...register("description")}
                rows={6}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={describedBy("p-description", { error: errors.description })}
                className={controlTextarea}
              />
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection
          title="Pricing"
          description="Entered in dollars; stored as integer cents."
        >
          <FormGrid>
            <Field id="p-price" label="Price" required error={errors.priceCents?.message}>
              <div className="relative">
                <span
                  aria-hidden
                  className="absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground"
                >
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
                  aria-invalid={Boolean(errors.priceCents)}
                  aria-describedby={describedBy("p-price", { error: errors.priceCents })}
                  className={cn(controlInput, "pl-6 tabular-nums")}
                />
              </div>
            </Field>

            <Field
              id="p-compare"
              label="Compare-at price"
              hint="Optional. Shown struck through. Must be higher than the price."
              error={errors.compareAtCents?.message}
            >
              <div className="relative">
                <span
                  aria-hidden
                  className="absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground"
                >
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
                  aria-invalid={Boolean(errors.compareAtCents)}
                  aria-describedby={describedBy("p-compare", {
                    hint: true,
                    error: errors.compareAtCents,
                  })}
                  className={cn(controlInput, "pl-6 tabular-nums")}
                />
              </div>
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection
          title="Photography"
          description="The first image is the primary one — it appears on cards, in search results and in link previews."
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
        </FormSection>

        <FormSection
          title="Digital file"
          description="The file the customer downloads after paying. A product cannot be published without one."
        >
          <DigitalFileField productId={productId ?? null} asset={asset} />
        </FormSection>

        {/* Sits directly after the file, because these are the two things a
            product needs before it can actually be sold: something to deliver,
            and a price Paddle will honour. */}
        <FormSection
          title="Paddle"
          description="Connects this product to a Paddle catalogue price. Checkout charges that price — never an amount sent from the browser."
        >
          <PaddleConnectionField
            productId={productId ?? null}
            priceCents={Number(watch("priceCents")) || 0}
            connection={paddle}
          />
        </FormSection>

        <FormSection
          title="Version"
          description="Optional. Shown to buyers beside the file, so they can tell editions apart."
        >
          <Field id="p-version" label="Version label" className="max-w-xs">
            <Input
              id="p-version"
              {...register("fileVersion")}
              placeholder="1.2"
              className={controlInput}
            />
          </Field>
        </FormSection>

        <FormSection
          title="Search engine listing"
          description="Optional. Left blank, these are generated from the product name, category and description."
        >
          <div className="space-y-4">
            <Field
              id="p-seo-title"
              label="SEO title"
              hint={`${seoTitleLength}/70 characters`}
              error={errors.seoTitle?.message}
            >
              <Input
                id="p-seo-title"
                {...register("seoTitle")}
                placeholder={`${watch("name") || "Product name"} | ${siteConfig.name}`}
                maxLength={70}
                aria-invalid={Boolean(errors.seoTitle)}
                aria-describedby={describedBy("p-seo-title", {
                  hint: true,
                  error: errors.seoTitle,
                })}
                className={controlInput}
              />
            </Field>

            <Field
              id="p-seo-description"
              label="SEO description"
              hint={`${seoDescriptionLength}/180 characters`}
              error={errors.seoDescription?.message}
            >
              <textarea
                id="p-seo-description"
                {...register("seoDescription")}
                rows={3}
                maxLength={180}
                placeholder="A short summary shown under the title in search results."
                aria-invalid={Boolean(errors.seoDescription)}
                aria-describedby={describedBy("p-seo-description", {
                  hint: true,
                  error: errors.seoDescription,
                })}
                className={controlTextarea}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Visibility"
          description="Where this product appears once it is saved."
        >
          <div className="space-y-4">
            <ToggleRow
              htmlFor="p-active"
              label="Published"
              description="Visible in the shop. Requires an uploaded file."
              control={
                <Checkbox
                  id="p-active"
                  checked={watch("isActive")}
                  onCheckedChange={(checked) => setValue("isActive", checked === true)}
                />
              }
            />

            <ToggleRow
              htmlFor="p-featured"
              label="Featured"
              description="Shown in Product Highlights on the homepage."
              control={
                <Checkbox
                  id="p-featured"
                  checked={watch("featured")}
                  onCheckedChange={(checked) => setValue("featured", checked === true)}
                />
              }
            />
          </div>
        </FormSection>
      </div>

      <FormActions className="mt-6">
        <ButtonLink href="/admin/products" variant="outline" size="pillSm">
          Cancel
        </ButtonLink>
        <Button type="submit" variant="brand" size="pillSm" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {productId ? "Save changes" : "Create product"}
        </Button>
      </FormActions>
    </form>
  );
}
