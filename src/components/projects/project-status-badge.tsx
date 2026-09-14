import { CircleCheck, CircleX, Clock, EyeOff } from "lucide-react";

import type { ProjectStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

/**
 * Status vocabulary for a customer's own projects, in the shape of
 * `OrderStatusBadge`: an icon and a word as well as a colour, so the state
 * reads without relying on colour alone.
 */
const PROJECT_STATUS = {
  PENDING: { label: "In review", Icon: Clock, className: "bg-amber-50 text-amber-800 ring-amber-200" },
  APPROVED: { label: "Approved", Icon: CircleCheck, className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  REJECTED: { label: "Not approved", Icon: CircleX, className: "bg-rose-50 text-rose-800 ring-rose-200" },
  HIDDEN: { label: "Hidden", Icon: EyeOff, className: "bg-slate-100 text-slate-700 ring-slate-200" },
} as const satisfies Record<ProjectStatus, unknown>;

export function ProjectStatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  const config = PROJECT_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        config.className,
        className,
      )}
    >
      <config.Icon className="size-3.5" aria-hidden />
      {config.label}
    </span>
  );
}
