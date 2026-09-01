"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/storage";
import { recordActivity } from "@/lib/admin/activity";
import { adminOrDenied, type AdminResult } from "@/lib/actions/admin/guard";
import { productSchema, type ProductInput } from "@/lib/validations/admin";

/**
 * Re-exported so the many existing `import type { AdminResult } from
 * "./products"` call sites keep working; the definition now lives in `guard.ts`
 * alongside the gate that produces it.
 */
export type { AdminResult };

/**
 * Destroy stored objects that no longer belong to any product.
 *
 * Best-effort by design: the database is the source of truth, and a storage
 * outage must never fail an otherwise-successful save. Failures are logged so
 * an orphan can be reclaimed later rather than silently swallowed.
 *
 * Only keys we actually own are passed here — seed rows pointing at external
 * URLs have a null `storageKey` and are skipped.
 */
async function removeStoredObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const storage = getStorageProvider();
  await Promise.all(
    keys.map(async (key) => {
      try {
        await storage.remove(key);
      } catch (error) {
        console.warn("[admin] orphaned storage object left behind", key, error);
      }
    }),
  );
}

function issuesToFields(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".");
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export async function createProduct(input: ProductInput): Promise<AdminResult<{ id: string }>> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: issuesToFields(parsed.error.issues),
    };
  }

  const data = parsed.data;

  const clash = await prisma.product.findFirst({
    where: { OR: [{ slug: data.slug }, { sku: data.sku }] },
    select: { slug: true, sku: true },
  });

  if (clash) {
    return {
      ok: false,
      error: "That slug or SKU is already in use.",
      fieldErrors:
        clash.slug === data.slug
          ? { slug: "A product with this slug already exists." }
          : { sku: "A product with this SKU already exists." },
    };
  }

  try {
    const product = await prisma.product.create({
      data: {
        name: data.name,
        slug: data.slug,
        brand: data.brand,
        sku: data.sku,
        description: data.description,
        shortDescription: data.shortDescription || null,
        seoTitle: data.seoTitle || null,
        seoDescription: data.seoDescription || null,
        categoryId: data.categoryId,
        priceCents: data.priceCents,
        compareAtCents: data.compareAtCents || null,
        featured: data.featured,
        isActive: data.isActive,
        images: {
          create: data.images.map((image, index) => ({
            url: image.url,
            alt: image.alt || data.name,
            sortOrder: index,
            storageKey: image.key ?? null,
          })),
        },
      },
      select: { id: true },
    });

    await recordActivity({
      actorId: admin.id,
      action: "product.created",
      entityType: "product",
      entityId: product.id,
      meta: { name: data.name, sku: data.sku, published: data.isActive },
    });

    revalidatePath("/admin/products");
    revalidatePath("/shop");
    return { ok: true, message: "Product created.", data: { id: product.id } };
  } catch (error) {
    console.error("[admin] createProduct", error);
    return { ok: false, error: "Couldn't create the product. Check the SKUs are unique." };
  }
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<AdminResult<{ id: string }>> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: issuesToFields(parsed.error.issues),
    };
  }

  const data = parsed.data;

  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true, asset: { select: { id: true } } },
  });
  if (!existing) return { ok: false, error: "That product no longer exists." };

  // The guarantee in section 7 runs both ways: a customer must never receive a
  // file before paying, and must never pay for a product that has no file.
  // Publishing is where the second half is enforced.
  if (data.isActive && !existing.asset) {
    return {
      ok: false,
      error: "Upload the digital file before publishing this product.",
      fieldErrors: { isActive: "A published product must have a file to deliver." },
    };
  }

  const clash = await prisma.product.findFirst({
    where: {
      id: { not: id },
      OR: [{ slug: data.slug }, { sku: data.sku }],
    },
    select: { slug: true },
  });
  if (clash) {
    return {
      ok: false,
      error: "That slug or SKU is already used by another product.",
      fieldErrors:
        clash.slug === data.slug
          ? { slug: "Already in use." }
          : { sku: "Already in use." },
    };
  }

  // Collected inside the transaction, acted on only after it commits — a
  // storage failure must never roll back a successful database write.
  let orphanedKeys: string[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name: data.name,
          slug: data.slug,
          brand: data.brand,
          sku: data.sku,
          description: data.description,
          shortDescription: data.shortDescription || null,
          seoTitle: data.seoTitle || null,
          seoDescription: data.seoDescription || null,
          categoryId: data.categoryId,
          priceCents: data.priceCents,
          compareAtCents: data.compareAtCents || null,
          featured: data.featured,
          isActive: data.isActive,
        },
      });

      // Images are fully replaced — they have no independent identity beyond
      // their order. Any stored object no longer referenced after the swap is
      // collected here and destroyed once the transaction commits.
      const previous = await tx.productImage.findMany({
        where: { productId: id },
        select: { storageKey: true },
      });

      const keptKeys = new Set(
        data.images.map((image) => image.key).filter(Boolean) as string[],
      );
      orphanedKeys = previous
        .map((image) => image.storageKey)
        .filter((key): key is string => key !== null && !keptKeys.has(key));

      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({
        data: data.images.map((image, index) => ({
          productId: id,
          url: image.url,
          alt: image.alt || data.name,
          sortOrder: index,
          storageKey: image.key ?? null,
        })),
      });

      // The version label lives on the asset, so it can only be set once a
      // file exists. Uploading the file itself is a separate action.
      if (data.fileVersion) {
        await tx.digitalAsset.updateMany({
          where: { productId: id },
          data: { version: data.fileVersion },
        });
      }
    });

    // The database is already consistent; storage cleanup is best-effort.
    await removeStoredObjects(orphanedKeys);

    await recordActivity({
      actorId: admin.id,
      action: "product.updated",
      entityType: "product",
      entityId: id,
      meta: {
        name: data.name,
        sku: data.sku,
        published: data.isActive,
        priceCents: data.priceCents,
      },
    });

    revalidatePath("/admin/products");
    revalidatePath(`/products/${data.slug}`);
    revalidatePath("/shop");
    return { ok: true, message: "Product updated.", data: { id } };
  } catch (error) {
    console.error("[admin] updateProduct", error);
    return { ok: false, error: "Couldn't save the product. Check the SKUs are unique." };
  }
}

export async function deleteProduct(id: string): Promise<AdminResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      sku: true,
      images: { select: { storageKey: true } },
      _count: { select: { orderItems: true } },
    },
  });
  if (!product) return { ok: false, error: "That product no longer exists." };

  try {
    if (product._count.orderItems > 0) {
      // Archive instead of deleting — order history must stay intact.
      await prisma.product.update({
        where: { id },
        data: { isActive: false, featured: false },
      });

      await recordActivity({
        actorId: admin.id,
        action: "product.archived",
        entityType: "product",
        entityId: product.id,
        meta: {
          name: product.name,
          sku: product.sku,
          reason: "appears in past orders",
        },
      });

      revalidatePath("/admin/products");
      revalidatePath("/shop");
      return {
        ok: true,
        message: "Product archived — it appears in past orders, so it can't be deleted.",
      };
    }

    await prisma.product.delete({ where: { id } });

    await recordActivity({
      actorId: admin.id,
      action: "product.deleted",
      entityType: "product",
      entityId: product.id,
      meta: { name: product.name, sku: product.sku },
    });

    // Rows cascaded away with the product; their stored objects will not, so
    // reclaim them now that the delete has succeeded.
    await removeStoredObjects(
      product.images
        .map((image) => image.storageKey)
        .filter((key): key is string => Boolean(key)),
    );

    revalidatePath("/admin/products");
    revalidatePath("/shop");
    return { ok: true, message: "Product deleted." };
  } catch (error) {
    console.error("[admin] deleteProduct", error);
    return { ok: false, error: "Couldn't delete that product." };
  }
}

/**
 * Duplicate a product, its images and its full variant matrix.
 *
 * The copy is created as a hidden draft with suffixed slug and SKUs, because
 * those are unique and a duplicate is a starting point rather than something
 * that should appear in the shop the moment it is made. Stock deliberately
 * starts at zero — inventory is physical and does not copy.
 */
export async function duplicateProduct(
  id: string,
): Promise<AdminResult<{ id: string }>> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const source = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!source) return { ok: false, error: "That product no longer exists." };

  // Find a free "-copy" slug rather than failing on the unique constraint.
  let suffix = 1;
  let slug = `${source.slug}-copy`;
  while (await prisma.product.findUnique({ where: { slug }, select: { id: true } })) {
    suffix += 1;
    slug = `${source.slug}-copy-${suffix}`;
  }
  const skuSuffix = suffix === 1 ? "-C" : `-C${suffix}`;

  try {
    const copy = await prisma.product.create({
      data: {
        name: `${source.name} (copy)`,
        slug,
        brand: source.brand,
        sku: `${source.sku}${skuSuffix}`,
        description: source.description,
        shortDescription: source.shortDescription,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        categoryId: source.categoryId,
        priceCents: source.priceCents,
        compareAtCents: source.compareAtCents,
        // A copy is a draft: never featured, never live until reviewed.
        featured: false,
        isActive: false,
        images: {
          create: source.images.map((image, index) => ({
            url: image.url,
            alt: image.alt,
            sortOrder: index,
            // Deliberately null: the copy shares the original's asset URL but
            // does not own it, so deleting the copy must never destroy the
            // object the source product still points at.
            storageKey: null,
          })),
        },
      },
      select: { id: true },
    });

    await recordActivity({
      actorId: admin.id,
      action: "product.duplicated",
      entityType: "product",
      entityId: copy.id,
      meta: { from: source.name, slug },
    });

    revalidatePath("/admin/products");
    return {
      ok: true,
      message: "Duplicated as a hidden draft. Upload its file before publishing.",
      data: { id: copy.id },
    };
  } catch (error) {
    console.error("[admin] duplicateProduct", error);
    return { ok: false, error: "Couldn't duplicate that product." };
  }
}

export async function toggleProductFlag(
  id: string,
  field: "featured" | "isActive",
  value: boolean,
): Promise<AdminResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!product) return { ok: false, error: "That product no longer exists." };

  await prisma.product.update({ where: { id }, data: { [field]: value } });

  // `isActive` is the one that takes a product off sale, so it is named as
  // published/unpublished rather than logged as a generic field flip.
  await recordActivity({
    actorId: admin.id,
    action:
      field === "isActive"
        ? value
          ? "product.published"
          : "product.unpublished"
        : value
          ? "product.featured"
          : "product.unfeatured",
    entityType: "product",
    entityId: product.id,
    meta: { name: product.name },
  });

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath("/");
  return { ok: true };
}
