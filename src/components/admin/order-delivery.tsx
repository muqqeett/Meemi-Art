import Link from "next/link";
import { Check, CircleAlert, Minus, Download, ShieldX } from "lucide-react";

import type { OrderIntelligence } from "@/lib/queries/order-intelligence";
import { cn } from "@/lib/utils";

/**
 * Did the customer actually get what they paid for?
 *
 * On a shop that sells files, that question has three links and all three have
 * to hold:
 *
 *     payment PAID  →  order COMPLETED  →  DigitalAccess granted
 *
 * Any one of them broken means somebody has been charged for something they
 * cannot download, and it is invisible on every other screen — the order looks
 * fine, the payment looks fine, and only the missing grant tells the truth.
 * So the chain is drawn explicitly and a break in it is the loudest thing on
 * the page.
 *
 * A grant is matched to its line by `orderItemId`, which is unique per item, so
 * an item with no matching row is genuinely undelivered rather than merely
 * unmatched.
 */

type Stage = { label: string; ok: boolean; note: string };

export function OrderDelivery({
  paid,
  completed,
  items,
  access,
}: {
  paid: boolean;
  completed: boolean;
  items: { id: string; name: string; slug: string }[];
  access: OrderIntelligence["access"];
}) {
  const byItem = new Map(access.map((a) => [a.orderItemId, a]));
  const granted = items.filter((item) => byItem.has(item.id)).length;
  const allGranted = items.length > 0 && granted === items.length;

  const stages: Stage[] = [
    { label: "Payment received", ok: paid, note: paid ? "Cleared" : "Not paid" },
    { label: "Order completed", ok: completed, note: completed ? "Fulfilled" : "Not completed" },
    {
      label: "Access granted",
      ok: allGranted,
      note: `${granted} of ${items.length} ${items.length === 1 ? "item" : "items"}`,
    },
  ];

  // Only a chain that started is broken. An unpaid order has not failed to
  // deliver — it has not been bought yet, and flagging it would make every
  // abandoned checkout look like an incident.
  const broken = paid && stages.some((s) => !s.ok);

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex items-start gap-3 rounded-md border px-4 py-3",
          broken
            ? "border-destructive/25 bg-destructive/[0.06]"
            : paid
              ? "border-success/25 bg-success/[0.06]"
              : "border-border bg-[var(--admin-raised)]",
        )}
      >
        <span aria-hidden className="mt-0.5 shrink-0">
          {broken ? (
            <CircleAlert className="size-4 text-destructive" />
          ) : paid ? (
            <Check className="size-4 text-success" />
          ) : (
            <Minus className="size-4 text-muted-foreground" />
          )}
        </span>
        <p className="min-w-0 text-sm">
          <span className="font-medium text-foreground">
            {broken
              ? "Delivery incomplete"
              : paid
                ? "Delivered"
                : "Not yet paid"}
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {broken
              ? "This order was paid for but the customer cannot download everything they bought."
              : paid
                ? "Payment cleared, order completed and every item granted."
                : "Delivery begins once the payment clears."}
          </span>
        </p>
      </div>

      {/* The chain. Stacks on a phone, runs across from `sm`. */}
      <ol className="grid gap-2 sm:grid-cols-3">
        {stages.map((stage) => (
          <li
            key={stage.label}
            className="flex items-center gap-2.5 rounded-md border border-border bg-[var(--admin-raised)] px-3 py-2.5"
          >
            <span
              aria-hidden
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full",
                stage.ok ? "bg-success/12 text-success" : "bg-muted-foreground/10 text-muted-foreground",
              )}
            >
              {stage.ok ? <Check className="size-3" /> : <Minus className="size-3" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-foreground">
                {stage.label}
              </span>
              <span className="block truncate text-[0.6875rem] text-muted-foreground">
                {stage.note}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {/* Per item, because an order with three files can be two-thirds
          delivered and the summary above would still read "incomplete". */}
      <ul className="divide-y divide-border border-t border-border">
        {items.map((item) => {
          const grant = byItem.get(item.id);
          const revoked = Boolean(grant?.revokedAt);

          return (
            <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <Link
                href={`/products/${item.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-royal-600"
              >
                {item.name}
              </Link>

              {grant && !revoked && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Download className="size-3 shrink-0" aria-hidden />
                  <span className="tabular-nums">
                    {grant.downloadCount}{" "}
                    {grant.downloadCount === 1 ? "download" : "downloads"}
                  </span>
                </span>
              )}

              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
                  revoked
                    ? "border-destructive/20 bg-destructive/8 text-destructive"
                    : grant
                      ? "border-success/20 bg-success/8 text-success"
                      : "border-warning/20 bg-warning/8 text-warning",
                )}
              >
                {revoked ? (
                  <ShieldX className="size-3" aria-hidden />
                ) : grant ? (
                  <Check className="size-3" aria-hidden />
                ) : (
                  <CircleAlert className="size-3" aria-hidden />
                )}
                {revoked ? "Revoked" : grant ? "Available" : "Not granted"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
