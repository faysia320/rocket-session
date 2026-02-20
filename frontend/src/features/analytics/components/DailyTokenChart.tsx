import { memo, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatTokens } from "@/lib/utils";
import type { DailyTokenUsage } from "@/types";

interface DailyTokenChartProps {
  data: DailyTokenUsage[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const COLORS = {
  input: "hsl(217, 91%, 60%)",
  output: "hsl(38, 92%, 50%)",
  cacheRead: "hsl(142, 71%, 45%)",
  cacheCreation: "hsl(217, 33%, 50%)",
};

export const DailyTokenChart = memo(function DailyTokenChart({
  data,
}: DailyTokenChartProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        date: formatDate(d.date),
        Input: d.input_tokens,
        Output: d.output_tokens,
        "Cache Read": d.cache_read_tokens,
        "Cache Write": d.cache_creation_tokens,
      })),
    [data],
  );

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-mono text-xs font-medium text-foreground mb-3">
          일별 토큰 사용량
        </h3>
        <div className="flex items-center justify-center h-[200px] text-muted-foreground text-xs font-mono">
          데이터가 없습니다
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="font-mono text-xs font-medium text-foreground mb-3">
        일별 토큰 사용량
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.input} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.input} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.output} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.output} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(217, 33%, 17%)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "hsl(215, 25%, 50%)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(215, 25%, 50%)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatTokens(v)}
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(220, 37%, 7%)",
              border: "1px solid hsl(217, 33%, 17%)",
              borderRadius: "6px",
              fontSize: "11px",
              fontFamily: "monospace",
            }}
            labelStyle={{ color: "hsl(215, 25%, 90%)" }}
            formatter={(value) =>
              typeof value === "number" ? [formatTokens(value)] : [String(value ?? 0)]
            }
          />
          <Legend
            wrapperStyle={{ fontSize: "10px", fontFamily: "monospace" }}
          />
          <Area
            type="monotone"
            dataKey="Input"
            stackId="1"
            stroke={COLORS.input}
            fill="url(#colorInput)"
            strokeWidth={1.5}
          />
          <Area
            type="monotone"
            dataKey="Output"
            stackId="1"
            stroke={COLORS.output}
            fill="url(#colorOutput)"
            strokeWidth={1.5}
          />
          <Area
            type="monotone"
            dataKey="Cache Read"
            stackId="1"
            stroke={COLORS.cacheRead}
            fill={COLORS.cacheRead}
            fillOpacity={0.15}
            strokeWidth={1}
          />
          <Area
            type="monotone"
            dataKey="Cache Write"
            stackId="1"
            stroke={COLORS.cacheCreation}
            fill={COLORS.cacheCreation}
            fillOpacity={0.1}
            strokeWidth={1}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});
