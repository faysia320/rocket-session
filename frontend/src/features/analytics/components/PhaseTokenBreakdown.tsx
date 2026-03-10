import { memo, useMemo } from "react";
import { formatTokens } from "@/lib/utils";
import type { PhaseTokenUsage } from "@/types";
import { useECharts } from "../lib/useECharts";
import {
  CHART_DIMENSIONS,
  CHART_ANIMATION,
  CHART_FONT,
  CHART_LABEL,
  getBaseAxis,
  getBaseGrid,
  getBaseTooltip,
  getBaseLegend,
  getSplitLineStyle,
} from "../lib/echartsConfig";
import { tokenTooltipFormatter } from "../lib/tooltipFormatter";
import { ChartCard } from "./ChartCard";

interface PhaseTokenBreakdownProps {
  data: PhaseTokenUsage[];
}

const PHASE_LABELS: Record<string, string> = {
  research: "Research",
  implement: "Implement",
};

export const PhaseTokenBreakdown = memo(function PhaseTokenBreakdown({
  data,
}: PhaseTokenBreakdownProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        name: PHASE_LABELS[d.workflow_phase ?? ""] ?? d.workflow_phase ?? "N/A",
        Input: d.input_tokens,
        Output: d.output_tokens,
      })),
    [data],
  );

  const option = useMemo(() => {
    if (chartData.length === 0) return null;
    const names = chartData.map((d) => d.name);
    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        ...getBaseTooltip(),
        formatter: tokenTooltipFormatter,
      },
      legend: {
        ...getBaseLegend(),
        data: ["Input", "Output"],
      },
      grid: getBaseGrid({
        left: CHART_DIMENSIONS.yAxisWidth.medium,
        right: 60,
        bottom: 16,
      }),
      xAxis: {
        type: "value",
        ...getBaseAxis(),
        axisLabel: {
          fontSize: CHART_FONT.axisTick,
          fontFamily: CHART_FONT.family,
          formatter: (v: number) => formatTokens(v),
        },
        splitLine: getSplitLineStyle(),
      },
      yAxis: {
        type: "category",
        data: names,
        ...getBaseAxis(),
      },
      animationDuration: CHART_ANIMATION.duration,
      animationEasing: CHART_ANIMATION.easing,
      series: [
        {
          name: "Input",
          type: "bar" as const,
          data: chartData.map((d) => d.Input),
          itemStyle: { borderRadius: [0, 3, 3, 0] },
          barGap: "15%",
          label: {
            show: true,
            position: "right" as const,
            formatter: (p: { value: number }) => formatTokens(p.value),
            fontSize: CHART_LABEL.fontSize,
            fontFamily: CHART_LABEL.fontFamily,
            fontWeight: CHART_LABEL.fontWeight,
          },
        },
        {
          name: "Output",
          type: "bar" as const,
          data: chartData.map((d) => d.Output),
          itemStyle: { borderRadius: [0, 3, 3, 0] },
          label: {
            show: true,
            position: "right" as const,
            formatter: (p: { value: number }) => formatTokens(p.value),
            fontSize: CHART_LABEL.fontSize,
            fontFamily: CHART_LABEL.fontFamily,
            fontWeight: CHART_LABEL.fontWeight,
          },
          animationDelay: CHART_ANIMATION.delayPerSeries,
        },
      ],
    };
  }, [chartData]);

  const { containerRef } = useECharts(option);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <ChartCard title="Phase별 토큰 사용량">
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: Math.max(chartData.length * 48, CHART_DIMENSIONS.minChartHeight),
        }}
      />
    </ChartCard>
  );
});
