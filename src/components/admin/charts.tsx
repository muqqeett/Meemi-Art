"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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
 * Purple is reserved for revenue, the headline metric; sapphire carries the
 * supporting series. Axes and gridlines stay deliberately low-contrast so the
 * data is the only saturated thing on the canvas.
 */
const BRAND = "#24113f"; // brand purple
const ROYAL = "#3157c8"; // sapphire
const GRID = "#e3daf5";
const MUTED = "#6f6a75";

const axisProps = {
  stroke: MUTED,
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

const tooltipStyle = {
  borderRadius: 12,
  border: `1px solid ${GRID}`,
  boxShadow: "0 12px 40px -12px rgb(36 17 63 / 0.28)",
  fontSize: 13,
} as const;

export function RevenueChart({
  data,
}: {
  data: { month: string; revenue: number; orders: number }[];
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.28} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis
            {...axisProps}
            tickFormatter={(value: number) => formatMoneyCompact(value * 100)}
            width={64}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [formatMoneyCompact(Number(value ?? 0) * 100), "Revenue"]}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={BRAND}
            strokeWidth={2}
            fill="url(#revenueFill)"
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
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} width={40} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "rgb(49 87 200 / 0.07)" }}
            formatter={(value) => [Number(value ?? 0), "Orders"]}
          />
          <Bar dataKey="orders" fill={ROYAL} radius={[6, 6, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Order status keeps its conventional signals at the ends of the lifecycle —
 * amber for waiting, green for completed, red for cancelled — because those
 * read faster than any brand colour. "Processing" sits in the brand family,
 * carrying no inherent colour meaning.
 *
 * These are the five members of `OrderStatus`. There is no SHIPPED or
 * DELIVERED: delivery is a download, so an order goes from paid straight to
 * completed with nothing in transit. Both were left here after the enum
 * changed, which meant a COMPLETED or REFUNDED slice had no colour at all.
 */
const STATUS_COLORS: Record<string, string> = {
  PENDING: "#8a5a12",
  PROCESSING: "#3157c8",
  COMPLETED: "#1f6b45",
  CANCELLED: "#b3261e",
  REFUNDED: "#7355b4",
};

export function OrderStatusChart({
  data,
}: {
  data: { status: string; count: number }[];
}) {
  const total = data.reduce((sum, entry) => sum + entry.count, 0);

  // An empty donut is a grey ring with no legend, which reads as a broken
  // chart rather than as "nothing has happened yet".
  if (total === 0) {
    return (
      <p className="py-14 text-center text-sm text-muted-foreground">No orders yet.</p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              innerRadius={54}
              outerRadius={82}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? MUTED} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* `min-w-0` lets the legend shrink beside the fixed-width donut instead
          of forcing the panel wider than its column. */}
      <ul className="w-full min-w-0 flex-1 space-y-2 text-sm">
        {data.map((entry) => (
          <li key={entry.status} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[entry.status] ?? MUTED }}
              />
              <span className="truncate capitalize text-muted-foreground">
                {entry.status.toLowerCase()}
              </span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {entry.count}
              <span className="ml-1.5 text-xs text-muted-foreground">
                {total > 0 ? `${Math.round((entry.count / total) * 100)}%` : "0%"}
              </span>
            </span>
          </li>
        ))}
      </ul>
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
            contentStyle={tooltipStyle}
            cursor={{ fill: "rgb(36 17 63 / 0.06)" }}
            formatter={(value) => [
              formatMoneyCompact(Number(value ?? 0) * 100),
              "Revenue",
            ]}
          />
          <Bar dataKey="revenue" fill={BRAND} radius={[0, 4, 4, 0]} maxBarSize={22} />
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
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="customerFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ROYAL} stopOpacity={0.22} />
              <stop offset="100%" stopColor={ROYAL} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} width={40} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [Number(value ?? 0), "New customers"]}
          />
          <Area
            type="monotone"
            dataKey="customers"
            stroke={ROYAL}
            strokeWidth={2}
            fill="url(#customerFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

