import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { safeAdminHref, type NotificationTypeName } from "@/lib/notifications/rules";

/**
 * Reading the notification feed and marking it read — one admin at a time.
 *
 * Notifications are shared by every admin; read state is not. It lives in
 * `AdminNotificationRead`, one row per admin per notification, so one admin
 * opening a notification never hides it from another. With two admin accounts
 * in production that is the difference between a shared inbox that works and
 * one where messages silently vanish.
 *
 * Every function re-checks the caller through `currentAdmin` and answers a
 * non-admin exactly as the rest of the admin API does — "Not found." — so the
 * existence of the feed is not confirmed to anyone else. Dependencies are
 * injectable so the harness can run each rule with no session.
 */

export type FeedDeps = {
  currentAdmin: () => Promise<{ id: string } | null>;
  db: Pick<PrismaClient, "adminNotification" | "adminNotificationRead" | "$executeRaw">;
};

function resolveDeps(overrides?: Partial<FeedDeps>): FeedDeps {
  return {
    // Loaded on use: the guard pulls in Next's navigation runtime, which the
    // harness (running outside Next) cannot load and never needs.
    currentAdmin: async () => (await import("@/lib/auth-guards")).getAdminOrNull(),
    db: prisma,
    ...overrides,
  };
}

export type FeedResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const denied = { ok: false, status: 404, error: "Not found." } as const;

export const FEED_PAGE_SIZE = 25;
/** The badge shows "99+" past this; counting further buys nothing. */
export const UNREAD_BADGE_CAP = 99;
/** Most ids one mark-read call accepts. */
const MAX_MARK = 100;

export type FeedFilter = "all" | "unread";

export type FeedItem = {
  id: string;
  type: NotificationTypeName;
  title: string;
  message: string;
  href: string | null;
  occurredAt: Date;
  read: boolean;
};

export type FeedPage = { items: FeedItem[]; page: number; pages: number; total: number; filter: FeedFilter };

export function parseFeedFilter(value: unknown): FeedFilter {
  return value === "unread" ? "unread" : "all";
}

const unreadBy = (userId: string) => ({ reads: { none: { userId } } }) satisfies Prisma.AdminNotificationWhereInput;

/**
 * One page of the feed, newest first, each row carrying this admin's read
 * state. Two queries — a count and a page — with the read state joined in
 * the page query itself, not looked up per row.
 */
export async function listNotifications(
  input: { filter?: unknown; page?: unknown },
  overrides?: Partial<FeedDeps>,
): Promise<FeedResult<FeedPage>> {
  const { currentAdmin, db } = resolveDeps(overrides);
  const admin = await currentAdmin();
  if (!admin) return denied;

  const filter = parseFeedFilter(input.filter);
  const where = filter === "unread" ? unreadBy(admin.id) : {};
  const requested = Number.parseInt(String(input.page ?? "1"), 10);

  const total = await db.adminNotification.count({ where });
  const pages = Math.max(1, Math.ceil(total / FEED_PAGE_SIZE));
  const page = Math.min(Math.max(1, Number.isFinite(requested) ? requested : 1), pages);

  const rows = await db.adminNotification.findMany({
    where,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * FEED_PAGE_SIZE,
    take: FEED_PAGE_SIZE,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      href: true,
      occurredAt: true,
      reads: { where: { userId: admin.id }, select: { readAt: true }, take: 1 },
    },
  });

  return {
    ok: true,
    data: {
      filter,
      page,
      pages,
      total,
      items: rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        href: safeAdminHref(row.href),
        occurredAt: row.occurredAt,
        read: row.reads.length > 0,
      })),
    },
  };
}

/**
 * How many notifications this admin has not read, up to the badge cap.
 *
 * Bounded by construction: it fetches at most `UNREAD_BADGE_CAP + 1` ids
 * rather than counting an unbounded table on every admin page.
 */
export async function unreadCount(overrides?: Partial<FeedDeps>): Promise<FeedResult<{ count: number; capped: boolean }>> {
  const { currentAdmin, db } = resolveDeps(overrides);
  const admin = await currentAdmin();
  if (!admin) return denied;

  const rows = await db.adminNotification.findMany({
    where: unreadBy(admin.id),
    select: { id: true },
    take: UNREAD_BADGE_CAP + 1,
  });
  return { ok: true, data: { count: Math.min(rows.length, UNREAD_BADGE_CAP), capped: rows.length > UNREAD_BADGE_CAP } };
}

/** Mark specific notifications read for this admin. Unknown ids are ignored. */
export async function markRead(ids: unknown, overrides?: Partial<FeedDeps>): Promise<FeedResult<{ marked: number }>> {
  const { currentAdmin, db } = resolveDeps(overrides);
  const admin = await currentAdmin();
  if (!admin) return denied;

  const list = (Array.isArray(ids) ? ids : [ids])
    .filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 64)
    .slice(0, MAX_MARK);
  if (list.length === 0) return { ok: false, status: 400, error: "Nothing to mark." };

  // Only ids that exist, so a guessed id cannot create a dangling read row.
  const found = await db.adminNotification.findMany({ where: { id: { in: list } }, select: { id: true } });
  if (found.length === 0) return { ok: true, data: { marked: 0 } };

  const result = await db.adminNotificationRead.createMany({
    data: found.map((row) => ({ notificationId: row.id, userId: admin.id })),
    skipDuplicates: true,
  });
  return { ok: true, data: { marked: result.count } };
}

/**
 * Mark everything this admin has not read, in one statement. Only notifications
 * that existed when it ran are marked; anything that arrives a moment later
 * stays unread, as it should.
 */
export async function markAllRead(overrides?: Partial<FeedDeps>): Promise<FeedResult<{ marked: number }>> {
  const { currentAdmin, db } = resolveDeps(overrides);
  const admin = await currentAdmin();
  if (!admin) return denied;

  const marked = await db.$executeRaw`
    INSERT INTO "AdminNotificationRead" ("notificationId", "userId", "readAt")
    SELECT n."id", ${admin.id}, NOW()
    FROM "AdminNotification" n
    WHERE NOT EXISTS (
      SELECT 1 FROM "AdminNotificationRead" r
      WHERE r."notificationId" = n."id" AND r."userId" = ${admin.id}
    )
    ON CONFLICT ("notificationId", "userId") DO NOTHING`;
  return { ok: true, data: { marked } };
}

/** Where one notification leads, for the "open" action — or null. */
export async function notificationTarget(id: unknown, overrides?: Partial<FeedDeps>): Promise<FeedResult<{ href: string | null }>> {
  const { currentAdmin, db } = resolveDeps(overrides);
  const admin = await currentAdmin();
  if (!admin) return denied;
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return { ok: false, status: 400, error: "Nothing to open." };

  const row = await db.adminNotification.findUnique({ where: { id }, select: { href: true } });
  if (!row) return { ok: false, status: 404, error: "That notification no longer exists." };
  return { ok: true, data: { href: safeAdminHref(row.href) } };
}
