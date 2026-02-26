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
import {
  useChartColors,
  getXAxisProps,
  getYAxisProps,
  getGridProps,
  CHART_DIMENSIONS,
  CHART_ANIMATION,
} from "../lib/chartConfig";
import { ChartTooltip } from "./ChartTooltip";
import { ChartLegend } from "./ChartLegend";
import { ChartCard } from "./ChartCard";

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

const PHASE_COLOR_KEYS: Record<string, string> = {
  research: "research",
  plan: "plan",
  implement: "implement",
  review: "review",
  test: "test",
};

export const SessionPhaseChart = memo(function SessionPhaseChart({
  data,
}: SessionPhaseChartProps) {
  const colors = useChartColors();

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
        const label = row.session_name ?? formatWorkDir(row.session_id, 28);
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

  const phaseColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [key, label] of Object.entries(PHASE_LABELS)) {
      const colorKey = PHASE_COLOR_KEYS[key] as keyof typeof colors | undefined;
      map[label] = colorKey ? colors[colorKey] : colors.cacheWrite;
    }
    return map;
  }, [colors]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <ChartCard title="세션별 Phase 토큰 분포">
      <ResponsiveContainer
        width="100%"
        height={Math.max(chartData.length * CHART_DIMENSIONS.barRowHeight, CHART_DIMENSIONS.minChartHeight)}
      >
        <BarChart data={chartData} layout="vertical" barGap={CHART_DIMENSIONS.barGap}>
          <CartesianGrid {...getGridProps(colors, { horizontal: false })} />
          <XAxis
            type="number"
            {...getXAxisProps(colors)}
            tickFormatter={(v: number) => formatTokens(v)}
          />
          <YAxis
            type="category"
            dataKey="name"
            {...getYAxisProps(colors, { width: CHART_DIMENSIONS.yAxisWidth.long })}
          />
          <Tooltip
            content={<ChartTooltip colors={colors} colorMap={phaseColorMap} />}
          />
          <Legend content={<ChartLegend colors={colors} />} />
          {phases.map((phase, i) => {
            const originalKey =
              Object.entries(PHASE_LABELS).find(([, v]) => v === phase)?.[0] ??
              phase.toLowerCase();
            const colorKey = PHASE_COLOR_KEYS[originalKey] as keyof typeof colors | undefined;
            return (
              <Bar
                key={phase}
                dataKey={phase}
                stackId="session"
                fill={colorKey ? colors[colorKey] : colors.cacheWrite}
                radius={[0, 3, 3, 0]}
                animationDuration={CHART_ANIMATION.duration}
                animationBegin={i * CHART_ANIMATION.delayPerSeries}
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
});
