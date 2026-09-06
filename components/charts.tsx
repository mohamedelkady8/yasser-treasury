"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Breakdown, DailyMovement } from "@/lib/database.types";
import { egp, egpShort, fmtDate } from "@/lib/format";

const AXIS = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    fontSize: 12,
    direction: "rtl" as const,
  },
  labelStyle: { color: "var(--muted-foreground)", marginBottom: 4 },
};

export function DailyMovementChart({ data }: { data: DailyMovement[] }) {
  const rows = data.map((d) => ({
    day: fmtDate(d.day).slice(0, 5),
    revenue: Number(d.revenue),
    expense: Number(d.expense),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--positive)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--positive)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--negative)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--negative)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="day" {...AXIS} />
        <YAxis {...AXIS} tickFormatter={egpShort} width={56} orientation="right" />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value, name) => [
            egp(Number(value ?? 0)),
            name === "revenue" ? "إيراد" : "مصروف",
          ]}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--positive)"
          strokeWidth={2}
          fill="url(#gRev)"
        />
        <Area
          type="monotone"
          dataKey="expense"
          stroke="var(--negative)"
          strokeWidth={2}
          fill="url(#gExp)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BreakdownChart({
  data,
  color = "var(--chart-1)",
}: {
  data: Breakdown[];
  color?: string;
}) {
  const rows = data.map((d) => ({
    name: d.name.length > 22 ? `${d.name.slice(0, 22)}…` : d.name,
    total: Number(d.total),
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 34)}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" {...AXIS} tickFormatter={egpShort} />
        <YAxis
          type="category"
          dataKey="name"
          {...AXIS}
          width={140}
          orientation="right"
        />
        <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [egp(Number(value ?? 0)), "الإجمالي"]} />
        <Bar dataKey="total" fill={color} radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary)",
];

export function RevenueTypeChart({ data }: { data: Breakdown[] }) {
  const rows = data.slice(0, 6).map((d) => ({
    name: d.name,
    value: Number(d.total),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={rows}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {rows.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP_STYLE} formatter={(value) => egp(Number(value ?? 0))} />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={8}
          formatter={(v: string) => (
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{v}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
