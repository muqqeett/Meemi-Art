"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoneyCompact } from "@/lib/money";

/**
 * Chart palette, mirroring the design tokens in `globals.css` — Recharts needs
 * literal values for its SVG fills rather than CSS custom properties, so these
 * are kept in one place and changed alongside the theme.
 *
 * Every series now sits on the MeemiArt violet–blush axis rather than mixing
 * in the storefront's sapphire, which read as a fifth, unrelated brand colour
 * whenever two charts appeared side by side. Each metric owns one hue:
 *
 *   revenue    deep brand purple
 *   orders     royal purple
 *   customers  blush
 *   ranked bars  the violet-to-blush ramp below
 *
 * Axes and gridlines stay deliberately low-contrast so the data is the only
 * saturated thing on the canvas.
 */
const BRAND = "#24113f"; // brand purple
const VIOLET = "#7b5fbf"; // the lit accent, for a series drawn on dark ground
const LAVENDER = "#c7b6e8";
const GRID = "#e3daf5";
const MUTED = "#6f6a75";

/**
 * Blush — MeemiArt's second identity colour, and until now absent from every
 * chart. `--color-blush` itself is a fill tone: at #f2afbd a one- or two-pixel
 * line over white lands near 1.6:1 and effectively disappears, so strokes use
 * the deepened tone, which measures ~3.9:1 against white and clears the 3:1
 * that WCAG asks of non-text graphics. Same hue family, drawn to be read.
 */
const BLUSH = "#f2afbd";
const BLUSH_DEEP = "#c26d86";

/** Royal purple — the orders series, so it no longer borrows the revenue
 *  violet or the sapphire that customers used to share. */
const ROYAL_PURPLE = "#5b3fa0";

/**
 * The category ramp: deep purple through violet and lavender into blush.
 *
 * Bars were previously one flat purple, which said nothing — a bar's colour
 * repeated the bar's length and no more. Ordered by rank, the ramp lets the
 * shape of the distribution register before any single label is read, and it
 * is the one place both identity colours appear together. Indexes past the end
 * wrap, so a long category list stays inside the palette rather than inventing
 * hues.
 */
const CATEGORY_RAMP = [
  "#2f1a55", // deep violet
  "#5b3fa0", // royal purple
  VIOLET, //    violet
  "#a88ad4", // light violet
  LAVENDER, //  lavender
  BLUSH_DEEP, // rose
  BLUSH, //     blush
];

const axisProps = {
  stroke: MUTED,
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

/** True when the viewer has asked for less motion. Read at render time. */
function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/**
 * One tooltip for every chart.
 *
 * Recharts' default is a bordered box with a label and a coloured key, which
 * reads as a library default wherever it appears. This is a small card: the
 * value first at reading weight, the period beneath it. `onDark` flips it for
 * the dashboard hero, where a white tooltip would be the brightest thing on
 * the panel.
 */
function ChartTooltip({
  active,
  payload,
  label,
  render,
  onDark = false,
}: {
  active?: boolean;
  payload?: { value?: number | string }[];
  label?: string | number;
  render: (value: number) => string;
  onDark?: boolean;
}): ReactNode {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);

  return (
    <div
      className={
        onDark
          ? "rounded-md border border-white/15 bg-[#1a0c2e]/95 px-3 py-2 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.6)] backdrop-blur-sm"
          : "rounded-md border border-border bg-card px-3 py-2 shadow-[0_12px_32px_-14px_rgb(36_17_63/0.35)]"
      }
    >
      <p
        className={
          onDark
            ? "text-sm font-semibold text-white tabular-nums"
            : "text-sm font-semibold text-foreground tabular-nums"
        }
      >
        {render(value)}
      </p>
      <p
        className={
          onDark
            ? "mt-0.5 text-[0.6875rem] tracking-wide text-brand-300 uppercase"
            : "mt-0.5 text-[0.6875rem] tracking-wide text-muted-foreground uppercase"
        }
      >
        {label}
      </p>
    </div>
  );
}

/**
 * Revenue over twelve months.
 *
 * `onDark` renders it for the dashboard hero — lavender line on the deep violet
 * panel, no gridlines, dimmed axes. The light rendering is kept for
 * `/admin/analytics`, which has no hero to sit on.
 *
 * The line draws itself in over 900ms on mount. Recharts animates an SVG path
 * from JavaScript, which the global `prefers-reduced-motion` CSS override
 * cannot reach, so the preference is read here and the animation is switched
 * off rather than merely shortened.
 */
export function RevenueChart({
  data,
  onDark = false,
  height = "h-72",
}: {
  data: { month: string; revenue: number; orders: number }[];
  onDark?: boolean;
  height?: string;
}) {
  const animate = !prefersReducedMotion();
  const line = onDark ? LAVENDER : BRAND;
  const axis = onDark ? { ...axisProps, stroke: "rgb(199 182 232 / 0.55)" } : axisProps;
  const fillId = onDark ? "revenueFillDark" : "revenueFill";

  return (
    <div className={`${height} w-full`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={onDark ? VIOLET : BRAND}
                stopOpacity={onDark ? 0.5 : 0.26}
              />
              <stop offset="100%" stopColor={onDark ? VIOLET : BRAND} stopOpacity={0.01} />
            </linearGradient>
          </defs>

          {/* The hero has no gridlines — the panel is already a strong ground
              and rules across it would fight the line. */}
          {!onDark && (
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          )}
          <XAxis dataKey="month" {...axis} />
          <YAxis
            {...axis}
            tickFormatter={(value: number) => formatMoneyCompact(value * 100)}
            width={64}
          />
          <Tooltip
            cursor={{
              stroke: onDark ? "rgb(199 182 232 / 0.45)" : GRID,
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }}
            content={
              <ChartTooltip onDark={onDark} render={(v) => formatMoneyCompact(v * 100)} />
            }
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={line}
            strokeWidth={2.25}
            fill={`url(#${fillId})`}
            isAnimationActive={animate}
            animationDuration={900}
            animationEasing="ease-out"
            // No dot until the pointer is on the series: twelve permanent dots
            // is clutter, one lit dot is a reading.
            dot={false}
            activeDot={{
              r: 4.5,
              fill: onDark ? "#ffffff" : BRAND,
              stroke: onDark ? VIOLET : "#ffffff",
              strokeWidth: 2.5,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrdersChart({
  data,
}: {
  data: { month: string; revenue: number; orders: number }[];
}) {
  const animate = !prefersReducedMotion();

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} width={40} />
          <Tooltip
            cursor={{ fill: "rgb(49 87 200 / 0.06)" }}
            content={
              <ChartTooltip render={(v) => `${v} ${v === 1 ? "order" : "orders"}`} />
            }
          />
          <Bar
            dataKey="orders"
            fill={ROYAL_PURPLE}
            radius={[4, 4, 0, 0]}
            maxBarSize={30}
            isAnimationActive={animate}
            animationDuration={700}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Revenue by category. Horizontal bars because category names are words, not
 * dates — they read far better along the axis than rotated under it.
 */
export function SalesByCategoryChart({
  data,
}: {
  data: { category: string; revenueCents: number; units: number }[];
}) {
  const animate = !prefersReducedMotion();

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No sales recorded yet.
      </p>
    );
  }

  const chartData = data.map((row) => ({
    category: row.category,
    revenue: row.revenueCents / 100,
    units: row.units,
  }));

  return (
    <div style={{ height: Math.max(200, chartData.length * 44) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
          <XAxis
            type="number"
            {...axisProps}
            tickFormatter={(value: number) => formatMoneyCompact(value * 100)}
          />
          <YAxis type="category" dataKey="category" {...axisProps} width={112} />
          <Tooltip
            cursor={{ fill: "rgb(36 17 63 / 0.05)" }}
            content={<ChartTooltip render={(v) => formatMoneyCompact(v * 100)} />}
          />
          <Bar
            dataKey="revenue"
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            isAnimationActive={animate}
            animationDuration={700}
            animationEasing="ease-out"
          >
            {/* Colour per bar rather than per series. The data, its order and
                its geometry are untouched — only the fill is chosen by rank. */}
            {chartData.map((row, index) => (
              <Cell
                key={row.category}
                fill={CATEGORY_RAMP[index % CATEGORY_RAMP.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CustomerGrowthChart({
  data,
}: {
  data: { month: string; customers: number }[];
}) {
  const animate = !prefersReducedMotion();

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="customerFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BLUSH_DEEP} stopOpacity={0.22} />
              <stop offset="100%" stopColor={BLUSH_DEEP} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} width={40} />
          <Tooltip
            cursor={{ stroke: GRID, strokeWidth: 1, strokeDasharray: "4 4" }}
            content={
              <ChartTooltip
                render={(v) => `${v} new ${v === 1 ? "customer" : "customers"}`}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="customers"
            stroke={BLUSH_DEEP}
            strokeWidth={2}
            fill="url(#customerFill)"
            isAnimationActive={animate}
            animationDuration={800}
            animationEasing="ease-out"
            dot={false}
            activeDot={{ r: 4, fill: BLUSH_DEEP, stroke: "#ffffff", strokeWidth: 2.5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Revenue by product.
 *
 * The same horizontal-bar treatment as `SalesByCategoryChart`, and for the same
 * reason: product names are words, not dates, so they read along the axis
 * rather than rotated beneath it. Kept as its own export because the label
 * width and the tooltip's unit differ — a category axis can be narrower than
 * one carrying full product names.
 */
export function ProductRevenueChart({
  data,
}: {
  data: { name: string; revenueCents: number; unitsSold: number }[];
}) {
  const animate = !prefersReducedMotion();

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No sales in this period.
      </p>
    );
  }

  const chartData = data.map((row) => ({
    // Long names would otherwise push the axis into the plot area.
    name: row.name.length > 26 ? `${row.name.slice(0, 25)}…` : row.name,
    revenue: row.revenueCents / 100,
    units: row.unitsSold,
  }));

  return (
    <div style={{ height: Math.max(200, chartData.length * 44) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
          <XAxis
            type="number"
            {...axisProps}
            tickFormatter={(value: number) => formatMoneyCompact(value * 100)}
          />
          <YAxis type="category" dataKey="name" {...axisProps} width={132} />
          <Tooltip
            cursor={{ fill: "rgb(36 17 63 / 0.05)" }}
            content={<ChartTooltip render={(v) => formatMoneyCompact(v * 100)} />}
          />
          <Bar
            dataKey="revenue"
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            isAnimationActive={animate}
            animationDuration={700}
            animationEasing="ease-out"
          >
            {/* Same ramp as the category chart, so a product's rank and a
                category's rank read the same way across the two screens. */}
            {chartData.map((row, index) => (
              <Cell
                key={row.name}
                fill={CATEGORY_RAMP[index % CATEGORY_RAMP.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------- daily trends

const TREND_TONES = { brand: BRAND, royal: ROYAL_PURPLE, blush: BLUSH_DEEP, violet: VIOLET } as const;

/** "2026-08-03" → "3 Aug", read as a calendar day (no time zone can shift it). */
function dayLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function TrendTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string;
  format: (value: number) => string;
}): ReactNode {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-[0_12px_32px_-14px_rgb(36_17_63/0.35)]">
      <p className="text-[0.6875rem] tracking-wide text-muted-foreground uppercase">{label ? dayLabel(label) : ""}</p>
      <ul className="mt-1 space-y-0.5">
        {payload.map((entry) => (
          <li key={entry.name} className="flex items-center gap-2 text-sm text-foreground tabular-nums">
            <span aria-hidden className="size-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-semibold">{format(Number(entry.value ?? 0))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One or more daily series over a reporting period.
 *
 * Days are Pakistani calendar days, zero-filled by the query, so a quiet day is
 * a point at zero rather than a gap. A period with nothing in any series shows
 * the empty state instead of a flat line. The chart is `role="img"` with the
 * period totals as its label, and the legend underneath is plain text, so the
 * figures are available without the SVG.
 */
export function DailyTrendChart({
  data,
  series,
  money = false,
  label,
}: {
  data: ({ day: string } & Record<string, number | string>)[];
  series: { key: string; label: string; tone: keyof typeof TREND_TONES }[];
  money?: boolean;
  label: string;
}) {
  const animate = !prefersReducedMotion();
  const format = (value: number) => (money ? formatMoneyCompact(Math.round(value * 100)) : value.toLocaleString("en-US"));
  const totals = series.map((s) => ({ ...s, total: data.reduce((sum, point) => sum + Number(point[s.key] ?? 0), 0) }));

  if (data.length === 0 || totals.every((s) => s.total === 0)) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No analytics data available for this period.</p>;
  }

  const summary = `${label}: ${totals.map((s) => `${s.label} ${format(s.total)}`).join(", ")}`;

  return (
    <div>
      <div className="h-64 w-full" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: money ? -4 : -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="day" {...axisProps} tickFormatter={dayLabel} minTickGap={24} />
            <YAxis {...axisProps} allowDecimals={money} width={money ? 60 : 40} tickFormatter={(v: number) => format(v)} />
            <Tooltip cursor={{ stroke: GRID, strokeWidth: 1, strokeDasharray: "4 4" }} content={<TrendTooltip format={format} />} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={TREND_TONES[s.tone]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#ffffff" }}
                isAnimationActive={animate}
                animationDuration={700}
                animationEasing="ease-out"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-hidden>
        {totals.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: TREND_TONES[s.tone] }} />
            {s.label} <span className="font-medium text-foreground tabular-nums">{format(s.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
