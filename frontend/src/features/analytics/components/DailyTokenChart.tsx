import { memo, useMemo } from "react";
import { formatTokens } from "@/lib/utils";
import type { DailyTokenUsage } from "@/types";
import { echarts } from "../lib/echarts";
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

interface DailyTokenChartProps {
  data: DailyTokenUsage[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const SERIES_KEYS = ["Input", "Output", "Cache Read", "Cache Write"] as const;

function makeGradient(color: string, topOpacity: number) {
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: `rgba(${hexOrNameToRgb(color)},${topOpacity})` },
    { offset: 1, color: `rgba(${hexOrNameToRgb(color)},0)` },
  ]);
}

/** Best-effort color string → r,g,b for rgba(). Falls back to theme color directly. */
function hexOrNameToRgb(color: string): string {
  // #rrggbb
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }
  // #rgb
  const short = color.match(/^#([0-9a-f]{3})$/i);
  if (short) {
    const r = parseInt(short[1][0] + short[1][0], 16);
    const g = parseInt(short[1][1] + short[1][1], 16);
    const b = parseInt(short[1][2] + short[1][2], 16);
    return `${r},${g},${b}`;
  }
  // rgba(r,g,b,a) or rgb(r,g,b)
  const rgb = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb) return `${rgb[1]},${rgb[2]},${rgb[3]}`;
  return "128,128,128";
}

export const DailyTokenChart = memo(function DailyTokenChart({
  data,
}: DailyTokenChartProps) {
  const option = useMemo(() => {
    const dates = data.map((d) => formatDate(d.date));
    const values = {
      Input: data.map((d) => d.input_tokens),
      Output: data.map((d) => d.output_tokens),
      "Cache Read": data.map((d) => d.cache_read_tokens),
      "Cache Write": data.map((d) => d.cache_creation_tokens),
    };

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        ...getBaseTooltip(),
        formatter: tokenTooltipFormatter,
      },
      legend: {
        ...getBaseLegend(),
        data: [...SERIES_KEYS],
      },
      grid: getBaseGrid({ left: CHART_DIMENSIONS.yAxisWidth.short }),
      xAxis: {
        type: "category",
        data: dates,
        ...getBaseAxis(),
      },
      yAxis: {
        type: "value",
        ...getBaseAxis(),
        axisLabel: {
          fontSize: CHART_FONT.axisTick,
          fontFamily: CHART_FONT.family,
          formatter: (v: number) => formatTokens(v),
        },
        splitLine: getSplitLineStyle(),
      },
      animationDuration: CHART_ANIMATION.duration,
      animationEasing: CHART_ANIMATION.easing,
      series: SERIES_KEYS.map((key, i) => ({
        name: key,
        type: "line" as const,
        stack: "total",
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2 },
        areaStyle: {
          color: makeGradient(
            // ECharts 테마가 color palette를 제공하므로, 기본 색상은 테마에서 가져옴
            // 여기서는 그라데이션만 적용
            ["#9b8bba", "#e098c7", "#8fd3e8", "#71669e"][i],
            [0.3, 0.3, 0.25, 0.2][i],
          ),
        },
        animationDelay: i * CHART_ANIMATION.delayPerSeries,
        data: values[key],
      })),
    };
  }, [data]);

  const { containerRef } = useECharts(option);

  return (
    <ChartCard title="일별 토큰 사용량" isEmpty={data.length === 0}>
      <div
        ref={containerRef}
        style={{ width: "100%", height: CHART_DIMENSIONS.areaChartHeight }}
      />
    </ChartCard>
  );
});
