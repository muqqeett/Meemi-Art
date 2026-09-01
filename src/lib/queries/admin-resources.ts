import "server-only";

import type { EmailStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Read models for the admin resources added in Phase 2.
 *
 * Every one of these reads data that already existed — `Payment`,
 * `PaymentEvent`, `DigitalAsset`, `DigitalAccess`, `EmailLog`, `AdminActivity`.
 * Nothing is computed that the database cannot answer, and nothing is
 * fabricated to fill a column.
 */

const PER_PAGE = 20;

/** Payments, newest first. Joined to the order for context. */
export async function listAdminPayments(options: { page?: number } = {}) {
  const page = Math.max(1, options.page ?? 1);

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
      select: {
        id: true,
        status: true,
        provider: true,
        amountCents: true,
        currency: true,
        createdAt: true,
        paidAt: true,
        refundedAt: true,
        failedAt: true,
        failureReason: true,
        cardBrand: true,
        cardLast4: true,
        providerTransactionId: true,
        order: {
          select: { orderNumber: true, customerName: true, email: true, status: true },
        },
      },
    }),
    prisma.payment.count(),
  ]);

  return { payments, total, page, pageCount: Math.max(1, Math.ceil(total / PER_PAGE)) };
}

/**
 * Refunded orders.
 *
 * Read-only, and deliberately so. The schema records that a refund happened
 * (`Payment.status = REFUNDED`, `refundedAt`) and nothing else — there is no
 * refunded amount, no reason and no requested-vs-processed distinction, and no
 * partial refund can be represented. So this reports what is true and says
 * plainly what is unavailable rather than inventing columns to fill a table.
 */
export async function listAdminRefunds(options: { page?: number } = {}) {
  const page = Math.max(1, options.page ?? 1);
  const where = { status: "REFUNDED" as const };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { refundedAt: "desc" },
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
      select: {
        id: true,
        amountCents: true,
        currency: true,
        refundedAt: true,
        paidAt: true,
        provider: true,
        providerTransactionId: true,
        order: {
          select: { orderNumber: true, customerName: true, email: true },
        },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return { payments, total, page, pageCount: Math.max(1, Math.ceil(total / PER_PAGE)) };
}

/**
 * The webhook ledger for one order.
 *
 * `PaymentEvent.orderId` is a plain indexed column, not a Prisma relation — so
 * this is a separate query keyed on that value rather than an `include`.
 * Modelling it as a relation would be inventing one.
 */
export async function listPaymentEvents(orderId: string) {
  return prisma.paymentEvent.findMany({
    where: { orderId },
    orderBy: { processedAt: "asc" },
    select: { id: true, provider: true, eventId: true, type: true, processedAt: true },
  });
}

/** Digital assets with their real download totals. */
export async function listAdminFiles(options: { page?: number } = {}) {
  const page = Math.max(1, options.page ?? 1);

  const [assets, total] = await Promise.all([
    prisma.digitalAsset.findMany({
      orderBy: { updatedAt: "desc" },
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
      select: {
        id: true,
        filename: true,
        contentType: true,
        bytes: true,
        version: true,
        updatedAt: true,
        // `storageKey` is deliberately not selected. It is the one value that
        // would let someone sign their own download URL, and the admin list has
        // no use for it.
        product: { select: { id: true, name: true, slug: true, isActive: true } },
      },
    }),
    prisma.digitalAsset.count(),
  ]);

  // Download counts live on the grants, not the asset. One grouped query for
  // the page rather than one per row.
  const productIds = assets.map((a) => a.product?.id).filter((id): id is string => Boolean(id));
  const grants = productIds.length
    ? await prisma.digitalAccess.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds } },
        _sum: { downloadCount: true },
        _count: { _all: true },
      })
    : [];

  const byProduct = new Map(
    grants.map((g) => [g.productId, { downloads: g._sum.downloadCount ?? 0, grants: g._count._all }]),
  );

  return {
    assets: assets.map((asset) => ({
      ...asset,
      downloads: asset.product ? (byProduct.get(asset.product.id)?.downloads ?? 0) : 0,
      grants: asset.product ? (byProduct.get(asset.product.id)?.grants ?? 0) : 0,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PER_PAGE)),
  };
}

/**
 * SKIPPED | SENT | FAILED — the real enum. There is no PENDING state: a send
 * either reached the provider, failed, or was skipped because no provider is
 * configured, and the log records which.
 */
export const EMAIL_STATUSES = ["SENT", "FAILED", "SKIPPED"] as const satisfies readonly EmailStatus[];

/** Narrows an untrusted URL value, so a hand-edited `?status=` cannot reach Prisma. */
export function parseEmailStatus(value: string | undefined): EmailStatus | undefined {
  return EMAIL_STATUSES.find((status) => status === value);
}

/** Every email the application has attempted, with its real outcome. */
export async function listAdminEmails(
  options: { page?: number; status?: EmailStatus } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const where: Prisma.EmailLogWhereInput = options.status ? { status: options.status } : {};

  const [emails, total, byStatus] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
      select: {
        id: true,
        to: true,
        template: true,
        subject: true,
        status: true,
        error: true,
        providerId: true,
        createdAt: true,
      },
    }),
    prisma.emailLog.count({ where }),
    prisma.emailLog.groupBy({ by: ["status"], _count: { status: true } }),
  ]);

  return {
    emails,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PER_PAGE)),
    byStatus: byStatus.map((row) => ({ status: row.status, count: row._count.status })),
  };
}

/** The audit trail, newest first. Empty until admins start acting. */
export async function listAdminActivity(options: { page?: number } = {}) {
  const page = Math.max(1, options.page ?? 1);

  const [entries, total] = await Promise.all([
    prisma.adminActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        meta: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
    }),
    prisma.adminActivity.count(),
  ]);

  return { entries, total, page, pageCount: Math.max(1, Math.ceil(total / PER_PAGE)) };
}
