import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { PROJECT_MODERATION_TRANSITIONS } from "@/lib/projects/moderation";
import { customerProjectStorage } from "@/lib/storage/customer-projects";

/**
 * The admin moderation queue.
 *
 * Read by `/admin/projects`, which sits behind the admin layout's
 * `requireAdmin`; every decision made from it goes through the moderation
 * actions, which check the role again against the database.
 *
 * Deliberately absent from each row: the image key, the owner's user id and
 * email. The photo is represented only by `previewUrl` — a signed delivery URL
 * for the still-private original, built by the storage module's existing
 * admin-preview helper. It is for this screen alone and never reaches a public
 * page.
 *
 * Which actions a row offers is taken from the same transition table the
 * moderation actions enforce, so the buttons match the rules; the actions
 * still refuse anything the table forbids.
 */

export const PROJECT_STATUSES: ProjectStatus[] = ["PENDING", "APPROVED", "REJECTED", "HIDDEN"];

const PER_PAGE = 15;

export type AdminProjectRow = {
  id: string;
  status: ProjectStatus;
  caption: string | null;
  displayName: string | null;
  rejectionReason: string | null;
  createdAt: string;
  moderatedAt: string | null;
  width: number;
  height: number;
  product: { name: string; slug: string };
  previewUrl: string | null;
  canApprove: boolean;
  canReject: boolean;
  canHide: boolean;
};

export async function listAdminProjects(options: { status: ProjectStatus | "ALL"; q?: string; page?: number }) {
  const page = Math.max(1, Math.floor(options.page ?? 1));

  const where: Prisma.CustomerProjectWhereInput = {};
  if (options.status !== "ALL") where.status = options.status;
  const q = options.q?.trim().slice(0, 100);
  if (q) {
    where.OR = [
      { caption: { contains: q, mode: "insensitive" } },
      { displayName: { contains: q, mode: "insensitive" } },
      { product: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  // The pending queue is worked oldest first. "All" puts the queue on top —
  // Postgres orders an enum by declaration, and PENDING is declared first.
  const orderBy: Prisma.CustomerProjectOrderByWithRelationInput[] =
    options.status === "PENDING"
      ? [{ createdAt: "asc" }]
      : options.status === "ALL"
        ? [{ status: "asc" }, { createdAt: "desc" }]
        : [{ moderatedAt: "desc" }, { createdAt: "desc" }];

  const [rows, total, grouped] = await Promise.all([
    prisma.customerProject.findMany({
      where,
      orderBy,
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
      select: {
        id: true,
        status: true,
        caption: true,
        displayName: true,
        rejectionReason: true,
        createdAt: true,
        moderatedAt: true,
        width: true,
        height: true,
        imageKey: true,
        format: true,
        product: { select: { name: true, slug: true } },
      },
    }),
    prisma.customerProject.count({ where }),
    prisma.customerProject.groupBy({ by: ["status"], _count: { status: true } }),
  ]);

  const projects: AdminProjectRow[] = rows.map(({ imageKey, format, ...row }) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    moderatedAt: row.moderatedAt?.toISOString() ?? null,
    previewUrl: customerProjectStorage.privatePreviewUrl(imageKey, format),
    canApprove: PROJECT_MODERATION_TRANSITIONS.approve.includes(row.status),
    canReject: PROJECT_MODERATION_TRANSITIONS.reject.includes(row.status),
    canHide: PROJECT_MODERATION_TRANSITIONS.hide.includes(row.status),
  }));

  const statusCounts = Object.fromEntries(
    PROJECT_STATUSES.map((status) => [status, grouped.find((row) => row.status === status)?._count.status ?? 0]),
  ) as Record<ProjectStatus, number>;

  return {
    projects,
    page,
    total,
    pageCount: Math.max(1, Math.ceil(total / PER_PAGE)),
    statusCounts,
  };
}
