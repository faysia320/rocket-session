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
import { formatTokens, formatWorkDir } from "@/lib/utils";
import type { SessionPhaseTokenUsage } from "@/types";

interface SessionPhaseChartProps {
  data: SessionPhaseTokenUsage[];
}

const PHASE_LABELS: Record<string, string> = {
  research: "Research",
  plan: "Plan",
  implement: "Implement",
  review: "Review",
  test: "Test",
};

const PHASE_COLORS: Record<string, string> = {
  research: "hsl(217, 91%, 60%)",
  plan: "hsl(38, 92%, 50%)",
  implement: "hsl(142, 71%, 45%)",
  review: "hsl(280, 70%, 60%)",
  test: "hsl(340, 75%, 55%)",
};
const DEFAULT_PHASE_COLOR = "hsl(217, 33%, 50%)";

export const SessionPhaseChart = memo(function SessionPhaseChart({
  data,
}: SessionPhaseChartProps) {
  const { chartData, phases } = useMemo(() => {
    const phaseSet = new Set<string>();
    for (const row of data) {
      if (row.workflow_phase) phaseSet.add(row.workflow_phase);
    }
    const phases = Array.from(phaseSet);

    const sessionMap = new Map<string, Record<string, unknown>>();
    for (const row of data) {
      const phase = row.workflow_phase ?? "unknown";
      const phaseLabel = PHASE_LABELS[phase] ?? phase;
      if (!sessionMap.has(row.session_id)) {
        const label = row.session_name ?? formatWorkDir(row.session_id, 20);
        sessionMap.set(row.session_id, { name: label });
      }
      const entry = sessionMap.get(row.session_id)!;
      entry[phaseLabel] = row.total_tokens;
    }

    return {
      chartData: Array.from(sessionMap.values()),
      phases: phases.map((p) => PHASE_LABELS[p] ?? p),
    };
  }, [data]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="font-mono text-xs font-medium text-foreground mb-3">
        세션별 Phase 토큰 분포
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(chartData.length * 40, 120)}>
        <BarChart data={chartData} layout="vertical" barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 17%)" horizontal={false} />
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
            width={120}
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
          <Legend wrapperStyle={{ fontSize: "10px", fontFamily: "monospace" }} />
          {phases.map((phase) => {
            const originalKey =
              Object.entries(PHASE_LABELS).find(([, v]) => v === phase)?.[0] ??
              phase.toLowerCase();
            return (
              <Bar
                key={phase}
                dataKey={phase}
                stackId="session"
                fill={PHASE_COLORS[originalKey] ?? DEFAULT_PHASE_COLOR}
                radius={[0, 3, 3, 0]}
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});
