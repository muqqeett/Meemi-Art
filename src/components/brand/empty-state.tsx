import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
  /** `page` fills a route; `inline` sits inside a card or panel. */
  variant?: "page" | "inline";
  /** `plum` is the Plum Studio treatment (plum-100 disc, Bricolage title). */
  tone?: "default" | "plum";
};

/**
 * Shared empty state so an empty cart, an empty wishlist and a search with no
 * results all read as the same product rather than three different screens.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  variant = "page",
  tone = "default",
}: EmptyStateProps) {
  if (tone === "plum") {
    return (
      <div
        className={cn(
          "font-figtree flex flex-col items-center justify-center text-center",
          variant === "page" ? "px-6 py-20" : "px-6 py-12",
          className,
        )}
      >
        <div
          aria-hidden
          className="mb-5 flex size-16 items-center justify-center rounded-full bg-plum-100"
        >
          <Icon className="size-7 text-plum-500" />
        </div>
        <h2 className="pl-display text-2xl leading-8 tracking-[-0.02em] sm:text-[28px] sm:leading-9">
          {title}
        </h2>
        <p className="pl-body mt-2 max-w-sm text-pl-muted">{description}</p>
        {action || secondaryAction ? (
          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
            {action}
            {secondaryAction}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variant === "page" ? "px-6 py-20" : "px-6 py-12",
        className,
      )}
    >
      <div
        aria-hidden
        className="mb-5 flex size-16 items-center justify-center rounded-full bg-brand-50"
      >
        <Icon className="size-7 text-brand-600" />
      </div>

      <h2
        className={cn(
          "font-semibold text-foreground",
          variant === "page" ? "text-xl sm:text-2xl" : "text-lg",
        )}
      >
        {title}
      </h2>

      <p className="text-body mt-2 max-w-sm">{description}</p>

      {action || secondaryAction ? (
        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
