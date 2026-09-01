import type { CSSProperties } from "react";
import Link from "next/link";
import {
  Check,
  CircleAlert,
  Clock,
  CreditCard,
  Download,
  FileKey,
  Receipt,
  RotateCcw,
  ShieldX,
  UserCog,
  Webhook,
  User,
  Star,
  Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type {
  TimelineEvent,
  TimelineIcon,
  TimelineTone,
} from "@/lib/admin/order-timeline-events";
import { cn } from "@/lib/utils";

/**
 * A history, rendered.
 *
 * Presentation only — events are built by the pure builders in
 * `lib/admin/order-timeline-events` (one order) and `lib/queries/customer-360`
 * (one customer). Both emit the same `TimelineEvent`, so this file is the only
 * place an icon key becomes a glyph, and both screens stay identical in look.
 *
 * An event carrying `href` becomes a link; one without stays plain text. That
 * is what lets the order timeline (already on its order) and the customer
 * timeline (spanning many) share a renderer.
 */

const ICONS: Record<TimelineIcon, LucideIcon> = {
  receipt: Receipt,
  card: CreditCard,
  check: Check,
  alert: CircleAlert,
  revoke: ShieldX,
  refund: RotateCcw,
  webhook: Webhook,
  key: FileKey,
  download: Download,
  admin: UserCog,
  user: User,
  review: Star,
  mail: Mail,
};

const TONE_STYLES: Record<TimelineTone, string> = {
  done: "border-success/25 bg-success/8 text-success",
  failed: "border-destructive/25 bg-destructive/8 text-destructive",
  warning: "border-warning/25 bg-warning/8 text-warning",
  info: "border-border bg-[var(--admin-raised)] text-muted-foreground",
};

export function AdminTimeline({
  events,
  emptyMessage = "Nothing has been recorded for this order yet.",
}: {
  events: TimelineEvent[];
  /** The default keeps Order 360's wording; the customer screen passes its own. */
  emptyMessage?: string;
}) {
  if (events.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ol className="relative px-4 py-2 sm:px-5">
      {/* One continuous hairline behind the markers, drawn on the list rather
          than per row so it never breaks between entries. */}
      <span
        aria-hidden
        className="absolute top-7 bottom-7 left-[1.9375rem] w-px bg-border sm:left-[2.1875rem]"
      />

      {events.map((event, index) => {
        const Icon = ICONS[event.icon];

        return (
          <li
            key={event.id}
            className="group/event admin-rise relative flex items-start gap-3.5 py-3"
            style={{ "--admin-i": index } as CSSProperties}
          >
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-px flex size-8 shrink-0 items-center justify-center rounded-full border",
                TONE_STYLES[event.tone],
              )}
            >
              <Icon className="size-3.5" />
            </span>

            <div className="min-w-0 flex-1">
              {event.href ? (
                <Link
                  href={event.href}
                  className="block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  <span className="block text-sm font-medium text-foreground transition-colors duration-150 group-hover/event:text-brand-700">
                    {event.title}
                  </span>
                </Link>
              ) : (
                <p className="text-sm font-medium text-foreground">{event.title}</p>
              )}

              {event.detail && (
                // Long provider strings, product names and order numbers wrap
                // rather than widening the card on a phone.
                <p className="mt-0.5 text-xs leading-relaxed break-words text-muted-foreground">
                  {event.detail}
                </p>
              )}
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground/80">
                <Clock className="size-3 shrink-0" aria-hidden />
                <time dateTime={event.at.toISOString()} className="tabular-nums">
                  {event.at.toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
