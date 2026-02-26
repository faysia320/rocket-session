import { memo, useId, useMemo } from "react";
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

interface DailyTokenChartProps {
  data: DailyTokenUsage[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export const DailyTokenChart = memo(function DailyTokenChart({ data }: DailyTokenChartProps) {
  const colors = useChartColors();
  const id = useId();

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

  const colorMap = useMemo(
    () => ({
      Input: colors.input,
      Output: colors.output,
      "Cache Read": colors.cacheRead,
      "Cache Write": colors.cacheWrite,
    }),
    [colors],
  );

  return (
    <ChartCard title="일별 토큰 사용량" isEmpty={chartData.length === 0}>
      <ResponsiveContainer width="100%" height={CHART_DIMENSIONS.areaChartHeight}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`${id}-input`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.input} stopOpacity={0.3} />
              <stop offset="95%" stopColor={colors.input} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`${id}-output`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.output} stopOpacity={0.3} />
              <stop offset="95%" stopColor={colors.output} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`${id}-cacheRead`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.cacheRead} stopOpacity={0.25} />
              <stop offset="95%" stopColor={colors.cacheRead} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`${id}-cacheWrite`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.cacheWrite} stopOpacity={0.2} />
              <stop offset="95%" stopColor={colors.cacheWrite} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...getGridProps(colors, { vertical: false })} />
          <XAxis dataKey="date" {...getXAxisProps(colors)} />
          <YAxis
            {...getYAxisProps(colors, { width: CHART_DIMENSIONS.yAxisWidth.short })}
            tickFormatter={(v: number) => formatTokens(v)}
          />
          <Tooltip
            content={<ChartTooltip colors={colors} colorMap={colorMap} />}
          />
          <Legend content={<ChartLegend colors={colors} />} />
          <Area
            type="monotone"
            dataKey="Input"
            stackId="1"
            stroke={colors.input}
            fill={`url(#${id}-input)`}
            strokeWidth={2}
            animationDuration={CHART_ANIMATION.duration}
          />
          <Area
            type="monotone"
            dataKey="Output"
            stackId="1"
            stroke={colors.output}
            fill={`url(#${id}-output)`}
            strokeWidth={2}
            animationDuration={CHART_ANIMATION.duration}
            animationBegin={CHART_ANIMATION.delayPerSeries}
          />
          <Area
            type="monotone"
            dataKey="Cache Read"
            stackId="1"
            stroke={colors.cacheRead}
            fill={`url(#${id}-cacheRead)`}
            strokeWidth={2}
            animationDuration={CHART_ANIMATION.duration}
            animationBegin={CHART_ANIMATION.delayPerSeries * 2}
          />
          <Area
            type="monotone"
            dataKey="Cache Write"
            stackId="1"
            stroke={colors.cacheWrite}
            fill={`url(#${id}-cacheWrite)`}
            strokeWidth={2}
            animationDuration={CHART_ANIMATION.duration}
            animationBegin={CHART_ANIMATION.delayPerSeries * 3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
});
