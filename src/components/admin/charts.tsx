"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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

