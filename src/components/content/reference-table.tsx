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
      <table className="font-figtree w-full min-w-[34rem] border-collapse text-sm leading-[22px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-pl-line">
            {columns.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={`py-2.5 pr-4 text-left align-bottom text-[13px] leading-[18px] font-bold tracking-[0.04em] text-pl-muted uppercase ${column.numeric ? "tabular-nums" : ""}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-pl-line">{children}</tbody>
      </table>
    </div>
  );
}
