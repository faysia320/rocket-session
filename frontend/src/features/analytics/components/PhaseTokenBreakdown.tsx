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
  LabelList,
} from "recharts";
import { formatTokens } from "@/lib/utils";
import type { PhaseTokenUsage } from "@/types";
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

interface PhaseTokenBreakdownProps {
  data: PhaseTokenUsage[];
}

const PHASE_LABELS: Record<string, string> = {
  research: "Research",
  plan: "Plan",
  implement: "Implement",
};

export const PhaseTokenBreakdown = memo(function PhaseTokenBreakdown({
  data,
}: PhaseTokenBreakdownProps) {
  const colors = useChartColors();

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        name: PHASE_LABELS[d.workflow_phase ?? ""] ?? d.workflow_phase ?? "N/A",
        Input: d.input_tokens,
        Output: d.output_tokens,
        turns: d.turn_count,
      })),
    [data],
  );

  const colorMap = useMemo(
    () => ({ Input: colors.input, Output: colors.output }),
    [colors],
  );

  if (chartData.length === 0) {
    return null;
  }

  return (
    <ChartCard title="Phase별 토큰 사용량">
      <ResponsiveContainer
        width="100%"
        height={Math.max(chartData.length * 48, CHART_DIMENSIONS.minChartHeight)}
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
            {...getYAxisProps(colors, { width: CHART_DIMENSIONS.yAxisWidth.medium })}
          />
          <Tooltip
            content={<ChartTooltip colors={colors} colorMap={colorMap} />}
          />
          <Legend content={<ChartLegend colors={colors} />} />
          <Bar
            dataKey="Input"
            fill={colors.input}
            radius={[0, 3, 3, 0]}
            animationDuration={CHART_ANIMATION.duration}
          >
            <LabelList
              dataKey="Input"
              position="right"
              formatter={formatTokens}
              style={{
                fontSize: 10,
                fill: colors.axisText,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
          </Bar>
          <Bar
            dataKey="Output"
            fill={colors.output}
            radius={[0, 3, 3, 0]}
            animationDuration={CHART_ANIMATION.duration}
            animationBegin={CHART_ANIMATION.delayPerSeries}
          >
            <LabelList
              dataKey="Output"
              position="right"
              formatter={formatTokens}
              style={{
                fontSize: 10,
                fill: colors.axisText,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
});
