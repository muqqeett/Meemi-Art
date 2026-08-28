import { Clock, Loader, CircleCheck, CircleX, Undo2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

/**
 * Status vocabulary for digital orders.
 *
 * `PENDING` means the customer has started a payment that has not been
 * confirmed — it is not a queue of work for the shop to do. Fulfilment is
 * instantaneous, so there is no shipped or delivered state between paying and
 * having the file.
 */
const ORDER_STATUS = {
  PENDING: {
    label: "Awaiting payment",
    Icon: Clock,
    className: "bg-amber-50 text-amber-800 ring-amber-200",
  },
  PROCESSING: {
    label: "Processing",
    Icon: Loader,
    className: "bg-blue-50 text-blue-800 ring-blue-200",
  },
  COMPLETED: {
    label: "Completed",
    Icon: CircleCheck,
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  CANCELLED: {
    label: "Cancelled",
    Icon: CircleX,
    className: "bg-rose-50 text-rose-800 ring-rose-200",
  },
  REFUNDED: {
    label: "Refunded",
    Icon: Undo2,
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  },
} as const satisfies Record<OrderStatus, unknown>;

const PAYMENT_STATUS = {
  PENDING: { label: "Payment pending", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  PROCESSING: { label: "Payment in progress", className: "bg-blue-50 text-blue-800 ring-blue-200" },
  PAID: { label: "Paid", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  FAILED: { label: "Payment failed", className: "bg-rose-50 text-rose-800 ring-rose-200" },
  CANCELLED: { label: "Payment cancelled", className: "bg-slate-100 text-slate-700 ring-slate-200" },
  REFUNDED: { label: "Refunded", className: "bg-slate-100 text-slate-700 ring-slate-200" },
} as const satisfies Record<PaymentStatus, unknown>;

const base =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset";

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const config = ORDER_STATUS[status];
  return (
    <span className={cn(base, config.className, className)}>
      <config.Icon className="size-3.5" aria-hidden />
      {config.label}
    </span>
  );
}

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  const config = PAYMENT_STATUS[status];
  return <span className={cn(base, config.className, className)}>{config.label}</span>;
}

/**
 * The happy path, in order. Cancelled and refunded are deliberately absent —
 * they are exits from the sequence, not steps along it.
 */
export const ORDER_TIMELINE: OrderStatus[] = ["PENDING", "PROCESSING", "COMPLETED"];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Awaiting payment",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};
