import type { ReactNode } from "react";

/**
 * A reference table that survives a phone.
 *
 * Wrapped in its own scroll region with a keyboard-reachable container, so a
 * wide conversion table can be read on a narrow screen without breaking the
 * page layout — and without collapsing into cards, which destroys the
 * row-to-row comparison that makes a conversion table useful in the first
 * place.
 *
 * The caption is real, not decoration: it is what a screen reader announces
 * when it enters the table.
 */
export function ReferenceTable({
  caption,
  columns,
  children,
}: {
  caption: string;
  columns: { label: string; numeric?: boolean }[];
  children: ReactNode;
}) {
  return (
    <div
      className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={`label-caps py-2.5 pr-4 text-left align-bottom text-muted-foreground ${column.numeric ? "tabular-nums" : ""}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">{children}</tbody>
      </table>
    </div>
  );
}
