import { memo, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatTokens } from "@/lib/utils";
import type { ProjectTokenUsage } from "@/types";

interface ProjectBreakdownProps {
  data: ProjectTokenUsage[];
}

const COLORS = {
  input: "hsl(217, 91%, 60%)",
  output: "hsl(38, 92%, 50%)",
};

export const ProjectBreakdown = memo(function ProjectBreakdown({
  data,
}: ProjectBreakdownProps) {
  const chartData = useMemo(
    () =>
      data.slice(0, 10).map((d) => ({
        name: d.project_name,
        Input: d.input_tokens,
        Output: d.output_tokens,
        sessions: d.session_count,
      })),
    [data],
  );

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-mono text-xs font-medium text-foreground mb-3">
          프로젝트별 토큰
        </h3>
        <div className="flex items-center justify-center h-[120px] text-muted-foreground text-xs font-mono">
          데이터가 없습니다
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="font-mono text-xs font-medium text-foreground mb-3">
        프로젝트별 토큰
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(chartData.length * 36, 120)}>
        <BarChart data={chartData} layout="vertical" barGap={2}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(217, 33%, 17%)"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "hsl(215, 25%, 50%)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatTokens(v)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fill: "hsl(215, 25%, 70%)" }}
            tickLine={false}
            axisLine={false}
            width={100}
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
          <Bar dataKey="Input" fill={COLORS.input} radius={[0, 3, 3, 0]} />
          <Bar dataKey="Output" fill={COLORS.output} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});
