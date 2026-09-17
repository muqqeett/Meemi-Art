import type { AssistantComparison as Comparison } from "@/lib/assistant/types";

/**
 * A side-by-side comparison inside the assistant panel.
 *
 * Every cell is built by the server from catalogue and difficulty data; the
 * model never writes one. The table scrolls sideways within its own box so a
 * long technique list never widens the chat column.
 */
export function AssistantComparison({ comparison }: { comparison: Comparison }) {
  return (
    <div className="overflow-x-auto rounded-sm border border-border bg-surface">
      <table className="w-full min-w-[20rem] border-collapse text-left text-xs">
        <caption className="sr-only">
          Comparison of {comparison.products.map((p) => p.name).join(" and ")}
        </caption>
        <thead>
          <tr className="border-b border-border">
            <td className="w-[28%] px-2.5 py-2" />
            {comparison.products.map((product) => (
              <th key={product.slug} scope="col" className="px-2.5 py-2 align-bottom font-semibold text-foreground">
                {product.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((row) => (
            <tr key={row.label} className="border-b border-border last:border-b-0">
              <th scope="row" className="px-2.5 py-2 align-top font-medium text-muted-foreground">
                {row.label}
              </th>
              {row.values.map((value, index) => (
                <td key={comparison.products[index]?.slug ?? index} className="px-2.5 py-2 align-top text-foreground">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
