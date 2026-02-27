import { memo, useCallback, useEffect, useMemo } from "react";
import { formatTokens, formatWorkDir } from "@/lib/utils";
import type { SessionPhaseTokenUsage } from "@/types";
import { useECharts } from "../lib/useECharts";
import {
  CHART_DIMENSIONS,
  CHART_ANIMATION,
  CHART_FONT,
  getBaseAxis,
  getBaseGrid,
  getBaseTooltip,
  getBaseLegend,
  getSplitLineStyle,
} from "../lib/echartsConfig";
import { tokenTooltipFormatter } from "../lib/tooltipFormatter";
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

export const SessionPhaseChart = memo(function SessionPhaseChart({ data }: SessionPhaseChartProps) {
  const { chartData, phases, sessionNames } = useMemo(() => {
    const phaseSet = new Set<string>();
    for (const row of data) {
      if (row.workflow_phase) phaseSet.add(row.workflow_phase);
    }
    const phases = Array.from(phaseSet).map((p) => PHASE_LABELS[p] ?? p);

    const sessionMap = new Map<string, Record<string, unknown>>();
    const nameList: string[] = [];
    for (const row of data) {
      const phase = row.workflow_phase ?? "unknown";
      const phaseLabel = PHASE_LABELS[phase] ?? phase;
      if (!sessionMap.has(row.session_id)) {
        const label = row.session_name ?? formatWorkDir(row.session_id, 28);
        sessionMap.set(row.session_id, { name: label });
        nameList.push(label);
      }
      const entry = sessionMap.get(row.session_id)!;
      entry[phaseLabel] = row.total_tokens;
    }

    return {
      chartData: Array.from(sessionMap.values()),
      phases,
      sessionNames: nameList,
    };
  }, [data]);

  const option = useMemo(() => {
    if (chartData.length === 0) return null;
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
        data: phases,
      },
      grid: getBaseGrid({
        left: CHART_DIMENSIONS.yAxisWidth.long,
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
        data: sessionNames,
        ...getBaseAxis(),
        axisLabel: {
          fontSize: CHART_FONT.axisTick,
          fontFamily: CHART_FONT.family,
          width: CHART_DIMENSIONS.yAxisWidth.long - 16,
          overflow: "truncate",
          ellipsis: "…",
        },
        triggerEvent: true,
      },
      animationDuration: CHART_ANIMATION.duration,
      animationEasing: CHART_ANIMATION.easing,
      series: phases.map((phase, i) => ({
        name: phase,
        type: "bar" as const,
        stack: "session",
        data: chartData.map((d) => (d[phase] as number | undefined) ?? 0),
        itemStyle: { borderRadius: [0, 3, 3, 0] },
        barCategoryGap: CHART_DIMENSIONS.barCategoryGap,
        animationDelay: i * CHART_ANIMATION.delayPerSeries,
      })),
    };
  }, [chartData, phases, sessionNames]);

  const { containerRef, chartRef } = useECharts(option);

  // y축 라벨 호버 시 전체 세션명을 native tooltip으로 표시
  const showLabelTooltip = useCallback(
    (params: { componentType: string; targetType?: string; value?: string }) => {
      if (params.componentType === "yAxis" && params.targetType === "axisLabel" && params.value) {
        const el = containerRef.current;
        if (el) el.title = params.value;
      }
    },
    [containerRef],
  );

  const clearLabelTooltip = useCallback(() => {
    const el = containerRef.current;
    if (el) el.title = "";
  }, [containerRef]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.on("mouseover", showLabelTooltip);
    chart.on("mouseout", clearLabelTooltip);
    return () => {
      chart.off("mouseover", showLabelTooltip);
      chart.off("mouseout", clearLabelTooltip);
    };
  }, [chartRef, showLabelTooltip, clearLabelTooltip]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <ChartCard title="세션별 Phase 토큰 분포">
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: Math.max(
            chartData.length * CHART_DIMENSIONS.barRowHeight,
            CHART_DIMENSIONS.minChartHeight,
          ),
        }}
      />
    </ChartCard>
  );
});
