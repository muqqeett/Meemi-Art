"use client";

import { useFilterParams, type CurrentParams } from "@/components/shop/use-filter-params";
import { FacetRow } from "@/components/shop/filter-panel";
import { PRICE_CHIPS, activePriceChip } from "@/components/category/price-chips";
import { cn } from "@/lib/utils";

export type SkillOption = { value: string; label: string; count: number };

/**
 * Category filters — Figma "Filters" (171:6014): a Skill level group and a
 * Price group, each a `fieldset` with a `legend`. Choices apply at once (no
 * Apply button) by writing to the URL, which re-runs the query on the server,
 * so a filtered page can be shared and the back button undoes a choice.
 *
 * Skill level is shown only when at least one product in the category has a
 * difficulty rating, and lists only the levels that have products.
 */
export function CategoryFilters({
  skill,
  params,
  onApplied,
}: {
  skill: SkillOption[];
  params: CurrentParams;
  onApplied?: () => void;
}) {
  const { get, setFilters, pending } = useFilterParams(params);

  const selected = new Set((get("skill") ?? "").split(",").filter(Boolean));
  const price = activePriceChip(get("minPrice"), get("maxPrice"));

  function toggleSkill(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setFilters({ skill: skill.filter((o) => next.has(o.value)).map((o) => o.value).join(",") });
    onApplied?.();
  }

  function pickPrice(chip: (typeof PRICE_CHIPS)[number]) {
    const on = price?.key === chip.key;
    setFilters({
      minPrice: on ? null : chip.min,
      maxPrice: on ? null : chip.max,
    });
    onApplied?.();
  }

  const legend = "pl-strong mb-2 block text-pl-text";

  return (
    <div className={cn("font-figtree flex flex-col gap-6", pending && "opacity-70")}>
      {skill.length > 0 && (
        <fieldset>
          <legend className={legend}>Skill level</legend>
          <ul>
            {skill.map((option) => (
              <li key={option.value}>
                <FacetRow
                  active={selected.has(option.value)}
                  label={option.label}
                  count={option.count}
                  onClick={() => toggleSkill(option.value)}
                />
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <fieldset>
        <legend className={legend}>Price</legend>
        <div className="flex flex-wrap gap-2">
          {PRICE_CHIPS.map((chip) => {
            const on = price?.key === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                aria-pressed={on}
                onClick={() => pickPrice(chip)}
                className={cn(
                  "pl-focus inline-flex h-9 items-center rounded-full border-[1.5px] px-3 text-[14px] leading-[18px] font-bold whitespace-nowrap transition-colors",
                  on
                    ? "border-plum-900 bg-pl-inverse text-pl-on-dark"
                    : "border-pl-line bg-pl-surface text-pl-text hover:bg-plum-100",
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
