"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAdminOrNull } from "@/lib/auth-guards";
import { categorySchema, couponSchema } from "@/lib/validations/admin";
import type { AdminResult } from "@/lib/actions/admin/products";

async function assertAdmin(): Promise<AdminResult | null> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "You don't have permission to do that." };
  return null;
}

function issuesToFields(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".");
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

function readCategoryForm(formData: FormData) {
  return categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    image: formData.get("image"),
    icon: formData.get("icon"),
    parentId: formData.get("parentId") || null,
    sortOrder: formData.get("sortOrder") ?? 0,
    isActive: formData.get("isActive") !== "false",
  });
}

// ------------------------------------------------------------------ categories

export async function saveCategory(
  _prev: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const parsed = readCategoryForm(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: issuesToFields(parsed.error.issues),
    };
  }

  const data = parsed.data;
  const id = formData.get("categoryId");
  const categoryId = typeof id === "string" && id ? id : null;

  // A category cannot be its own parent.
  const parentId = data.parentId && data.parentId !== categoryId ? data.parentId : null;

  const clash = await prisma.category.findFirst({
    where: { slug: data.slug, ...(categoryId ? { id: { not: categoryId } } : {}) },
    select: { id: true },
  });
  if (clash) {
    return {
      ok: false,
      error: "That slug is already in use.",
      fieldErrors: { slug: "A category with this slug already exists." },
    };
  }

  const payload = {
    name: data.name,
    slug: data.slug,
    description: data.description || null,
    image: data.image || null,
    icon: data.icon || null,
    parentId,
    sortOrder: data.sortOrder,
    isActive: data.isActive,
  };

  if (categoryId) {
    await prisma.category.update({ where: { id: categoryId }, data: payload });
  } else {
    await prisma.category.create({ data: payload });
  }

  revalidatePath("/admin/categories");
  revalidatePath("/shop");
  revalidatePath("/");
  return { ok: true, message: categoryId ? "Category updated." : "Category created." };
}

export async function deleteCategory(id: string): Promise<AdminResult> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const category = await prisma.category.findUnique({
    where: { id },
    select: { id: true, _count: { select: { products: true, children: true } } },
  });
  if (!category) return { ok: false, error: "That category no longer exists." };

  // Products reference categories with onDelete: Restrict, so refuse clearly
  // rather than letting the database throw.
  if (category._count.products > 0) {
    return {
      ok: false,
      error: `That category still has ${category._count.products} ${
        category._count.products === 1 ? "product" : "products"
      }. Move them first.`,
    };
  }

  await prisma.category.delete({ where: { id } });

  revalidatePath("/admin/categories");
  revalidatePath("/shop");
  return { ok: true, message: "Category deleted." };
}

// ------------------------------------------------------------------ coupons

export async function saveCoupon(
  _prev: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const maxUsesRaw = formData.get("maxUses");

  const parsed = couponSchema.safeParse({
    code: formData.get("code"),
    description: formData.get("description"),
    type: formData.get("type"),
    value: formData.get("value"),
    minOrderCents: formData.get("minOrderCents") ?? 0,
    maxUses: maxUsesRaw && maxUsesRaw !== "" ? maxUsesRaw : null,
    startsAt: formData.get("startsAt") || new Date(),
    expiresAt: formData.get("expiresAt") || null,
    isActive: formData.get("isActive") !== "false",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: issuesToFields(parsed.error.issues),
    };
  }

  const data = parsed.data;
  const id = formData.get("couponId");
  const couponId = typeof id === "string" && id ? id : null;

  const clash = await prisma.coupon.findFirst({
    where: { code: data.code, ...(couponId ? { id: { not: couponId } } : {}) },
    select: { id: true },
  });
  if (clash) {
    return {
      ok: false,
      error: "That code already exists.",
      fieldErrors: { code: "A coupon with this code already exists." },
    };
  }

  const payload = {
    code: data.code,
    description: data.description || null,
    type: data.type,
    value: data.value,
    minOrderCents: data.minOrderCents,
    maxUses: data.maxUses ?? null,
    startsAt: data.startsAt,
    expiresAt: data.expiresAt ?? null,
    isActive: data.isActive,
  };

  if (couponId) {
    await prisma.coupon.update({ where: { id: couponId }, data: payload });
  } else {
    await prisma.coupon.create({ data: payload });
  }

  revalidatePath("/admin/coupons");
  return { ok: true, message: couponId ? "Coupon updated." : "Coupon created." };
}

export async function deleteCoupon(id: string): Promise<AdminResult> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const coupon = await prisma.coupon.findUnique({
    where: { id },
    select: { id: true, _count: { select: { orders: true } } },
  });
  if (!coupon) return { ok: false, error: "That coupon no longer exists." };

  if (coupon._count.orders > 0) {
    // Orders reference the coupon for reporting; deactivate instead.
    await prisma.coupon.update({ where: { id }, data: { isActive: false } });
    revalidatePath("/admin/coupons");
    return {
      ok: true,
      message: "Coupon deactivated — it's referenced by existing orders.",
    };
  }

  await prisma.coupon.delete({ where: { id } });
  revalidatePath("/admin/coupons");
  return { ok: true, message: "Coupon deleted." };
}

export async function toggleCoupon(id: string, isActive: boolean): Promise<AdminResult> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const coupon = await prisma.coupon.findUnique({ where: { id }, select: { id: true } });
  if (!coupon) return { ok: false, error: "That coupon no longer exists." };

  await prisma.coupon.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/coupons");
  return { ok: true };
}

// ------------------------------------------------------------------ orders

/**
 * Cancel an order that was never paid for.
 *
 * This is the whole of an admin's authority over order state. Marking an order
 * paid, or refunded, would be claiming something about money that only the
 * payment provider can know — those transitions arrive over a signed webhook
 * and nowhere else.
 *
 * Guarded on the payment row rather than the order status: if a payment has
 * reached PAID, the order is not cancellable here no matter what the order row
 * says, which closes the gap between a webhook landing and this page's cached
 * copy of the status.
 */
export async function cancelUnpaidOrder(orderId: string): Promise<AdminResult> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      orderNumber: true,
      payment: { select: { id: true, status: true } },
    },
  });
  if (!order) return { ok: false, error: "That order no longer exists." };

  if (order.payment?.status === "PAID") {
    return {
      ok: false,
      error: "That order has been paid. Refund it in the payment provider instead.",
    };
  }

  if (order.status === "CANCELLED") {
    return { ok: false, error: "That order is already cancelled." };
  }

  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "CANCELLED", cancelledAt: now },
      });

      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { status: "CANCELLED", cancelledAt: now },
        });
      }
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${order.orderNumber}`);
    revalidatePath("/account/orders");
    return { ok: true, message: "Order cancelled." };
  } catch (error) {
    console.error("[admin] cancelUnpaidOrder", error);
    return { ok: false, error: "Couldn't cancel that order." };
  }
}
