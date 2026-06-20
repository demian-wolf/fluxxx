import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SpendPoint } from "@/types";
import { formatCents } from "@/lib/utils";

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ value: number; payload: SpendPoint }>;
}

function ChartTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  return (
    <div className="rounded-lg border border-line bg-bg-raised/95 px-3 py-2 text-xs shadow-card">
      <p className="font-mono text-ink">{point.payload.label}</p>
      <p className="mt-1 text-ink-muted">
        Spent:{" "}
        <span className="font-mono text-flux-cyan">
          {formatCents(point.value)}
        </span>
      </p>
    </div>
  );
}

export function SpendLineChart({
  data,
  limitCents,
  height = 220,
}: {
  data: SpendPoint[];
  limitCents?: number;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1e2740" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          stroke="#5d678a"
          tick={{ fontSize: 11, fill: "#9aa6c2" }}
          tickLine={false}
          axisLine={{ stroke: "#1e2740" }}
          interval={3}
        />
        <YAxis
          stroke="#5d678a"
          tick={{ fontSize: 11, fill: "#9aa6c2" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => formatCents(v)}
          width={64}
        />
        <Tooltip content={<ChartTooltip />} />
        {limitCents != null && (
          <ReferenceLine
            y={limitCents}
            stroke="#fbbf24"
            strokeDasharray="4 4"
            label={{
              value: `limit ${formatCents(limitCents)}`,
              fill: "#fbbf24",
              fontSize: 10,
              position: "insideTopRight",
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="spent_cents"
          stroke="#22d3ee"
          strokeWidth={2}
          fill="url(#spendFill)"
          dot={false}
          activeDot={{ r: 4, fill: "#22d3ee" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
