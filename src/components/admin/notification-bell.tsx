import Link from "next/link";
import { Bell } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The header's way into Notifications, with this admin's unread count.
 *
 * Server component: a link and a number, no client JavaScript. The count is
 * read in the admin layout, per admin — another admin's reading does not
 * clear this one's badge.
 *
 * Sized and styled like the header's other controls, so it sits in the bar
 * rather than on top of it. The badge carries the number in text as well as
 * colour, and the accessible name says it in words.
 */
export function NotificationBell({ count, capped }: { count: number; capped: boolean }) {
  const shown = capped ? `${count}+` : String(count);
  const label = count === 0 ? "Notifications" : `Notifications, ${shown} unread`;

  return (
    <Link
      href="/admin/notifications"
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground",
        "transition-colors duration-150 hover:bg-[var(--admin-hover)] hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
      )}
    >
      <Bell className="size-[1.125rem]" aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[0.625rem] leading-none font-semibold text-white tabular-nums ring-2 ring-card"
        >
          {shown}
        </span>
      )}
    </Link>
  );
}
