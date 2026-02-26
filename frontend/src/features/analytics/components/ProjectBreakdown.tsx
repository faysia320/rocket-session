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
import type { ProjectTokenUsage } from "@/types";
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

interface ProjectBreakdownProps {
  data: ProjectTokenUsage[];
}

export const ProjectBreakdown = memo(function ProjectBreakdown({ data }: ProjectBreakdownProps) {
  const colors = useChartColors();

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

  const colorMap = useMemo(
    () => ({ Input: colors.input, Output: colors.output }),
    [colors],
  );

  return (
    <ChartCard title="프로젝트별 토큰" isEmpty={chartData.length === 0}>
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
