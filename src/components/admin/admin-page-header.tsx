import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The title row every admin screen opens with.
 *
 * One hierarchy, used everywhere: an optional eyebrow, a confident but not
 * enormous title, a subdued single line of description, and the page's actions
 * pushed to the far edge. Titles are 20/24px rather than the 30px+ a marketing
 * page would use — an operator reads this once and then works below it.
 */
export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  /** Small tracked-out label above the title, e.g. the parent resource. */
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "admin-page-header mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="admin-eyebrow admin-eyebrow--accent mb-1.5">{eyebrow}</p>}
        <h1 className="text-xl font-semibold tracking-[-0.015em] text-foreground sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {/* Actions wrap under the title on a narrow screen rather than squeezing
          it, and stay right-aligned from `sm` up. */}
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}

/**
 * The surface admin tables sit on.
 *
 * The table brings its own header ground and row rules (`.admin-table`), so
 * this contributes only the outer hairline and the horizontal scroll a wide
 * table needs on a narrow screen — the columns scroll, never the page.
 */
export function AdminTableCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("admin-card overflow-hidden", className)}>
      <div className="w-full overflow-x-auto">{children}</div>
    </div>
  );
}

/**
 * A titled section of a page — the dashboard's chart panels, a form's field
 * group, a detail page's sub-section.
 *
 * `action` is the quiet link that belongs with a section rather than with the
 * page ("View all"). The header rule is omitted when there is no title, so a
 * bare panel is just a surface.
 */
export function AdminSection({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  style,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Carries the `--admin-i` stagger index where a page sequences sections. */
  style?: CSSProperties;
}) {
  return (
    <section className={cn("admin-card", className)} style={style}>
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
