import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  /** Small uppercase orange label above the title, e.g. "WHAT'S HOT". */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "center" | "start";
  /** Heading level — sections on a page should not all be `h2` if nested. */
  as?: "h1" | "h2" | "h3";
  className?: string;
  /** Optional trailing control, e.g. a "View all" link on wide screens. */
  action?: ReactNode;
};

/**
 * The repeated section title block from the homepage: optional orange eyebrow,
 * a medium-weight heading, and a muted one-line description.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  as: Heading = "h2",
  className,
  action,
}: SectionHeaderProps) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        centered
          ? "items-center text-center"
          : "items-start text-left sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className={cn("flex flex-col gap-2", centered && "items-center")}>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <Heading className="heading-section">{title}</Heading>
        {description ? (
          <p className={cn("text-body max-w-2xl", centered && "mx-auto")}>{description}</p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
