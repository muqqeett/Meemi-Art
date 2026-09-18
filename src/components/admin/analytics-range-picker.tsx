import Link from "next/link";
import { CalendarRange } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PRESET_LABELS, type DateRange, type RangePreset } from "@/lib/analytics/date-range";
import { cn } from "@/lib/utils";

/**
 * Reporting-period control for the admin analytics pages.
 *
 * Server-rendered: presets are links and the custom range is a plain GET form,
 * so choosing a period re-runs the queries on the server and works without
 * JavaScript. Other query parameters (a sort, say) are carried through; the
 * page number is not, since a new period starts on page one.
 *
 * Dates are calendar days in Pakistan (Asia/Karachi), inclusive at both ends.
 */
export function AnalyticsRangePicker({
  basePath,
  range,
  invalid,
  allowAll = false,
  keep = {},
}: {
  basePath: string;
  range: DateRange;
  invalid?: string | null;
  allowAll?: boolean;
  /** Other parameters to preserve, e.g. `{ sort: "views" }`. */
  keep?: Record<string, string>;
}) {
  const presets: Exclude<RangePreset, "custom">[] = ["today", "7d", "30d", "90d", ...(allowAll ? (["all"] as const) : [])];
  const href = (preset: string) => {
    const params = new URLSearchParams({ ...keep, range: preset });
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <nav aria-label="Reporting period" className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <Link
            key={preset}
            href={href(preset)}
            aria-current={range.preset === preset ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center rounded-md border px-3 text-[0.8125rem] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
              range.preset === preset
                ? "border-brand-300 bg-brand-50 font-medium text-brand-700"
                : "border-border text-muted-foreground hover:border-brand-200 hover:bg-[var(--admin-hover)] hover:text-foreground",
            )}
          >
            {preset === "today" ? PRESET_LABELS.today : preset === "all" ? PRESET_LABELS.all : preset.replace("d", " days")}
          </Link>
        ))}
      </nav>

      <form method="get" action={basePath} className="flex flex-wrap items-end gap-1.5" aria-label="Custom period">
        {Object.entries(keep).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <input type="hidden" name="range" value="custom" />
        <div>
          <Label htmlFor={`${basePath}-from`} className="sr-only">
            From
          </Label>
          <Input
            id={`${basePath}-from`}
            type="date"
            name="from"
            required
            defaultValue={range.preset === "custom" ? (range.fromDate ?? "") : ""}
            max={range.toDate}
            className="h-8 w-[9.5rem] rounded-md border-border text-[0.8125rem]"
          />
        </div>
        <span aria-hidden className="pb-1.5 text-xs text-muted-foreground">
          –
        </span>
        <div>
          <Label htmlFor={`${basePath}-to`} className="sr-only">
            To
          </Label>
          <Input
            id={`${basePath}-to`}
            type="date"
            name="to"
            required
            defaultValue={range.preset === "custom" ? range.toDate : ""}
            className="h-8 w-[9.5rem] rounded-md border-border text-[0.8125rem]"
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          aria-current={range.preset === "custom" ? "page" : undefined}
          className={cn("h-8 text-[0.8125rem]", range.preset === "custom" && "border-brand-300 bg-brand-50 text-brand-700")}
        >
          <CalendarRange aria-hidden />
          Apply
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        {range.label}
        {range.fromDate && range.fromDate !== range.toDate && range.preset !== "custom" && (
          <> · {range.fromDate} to {range.toDate}</>
        )}{" "}
        · Pakistan time
      </p>
      {invalid && (
        <p role="alert" className="text-xs text-destructive">
          {invalid} Showing the last 30 days instead.
        </p>
      )}
    </div>
  );
}
