import type { ReactNode } from "react";

/** Consistent title row across every admin screen. */
export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {description && <p className="text-body mt-1">{description}</p>}
      </div>
      {action}
    </header>
  );
}

/** Card wrapper for admin tables, with the scroll container tables need. */
export function AdminTableCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
