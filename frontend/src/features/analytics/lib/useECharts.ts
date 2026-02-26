import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { echarts } from "./echarts";
import type { ECharts } from "echarts/core";
import "./registerThemes";

export function useECharts(option: Record<string, unknown> | null) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const optionRef = useRef(option);

  const { resolvedTheme } = useTheme();
  const themeName = resolvedTheme === "dark" ? "purple-passion" : "roma";

  // optionRef를 effect 내에서만 업데이트 (렌더 중 ref 접근 방지)
  useEffect(() => {
    optionRef.current = option;
  });

  // theme 변경 → dispose + re-init
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    chartRef.current?.dispose();
    const chart = echarts.init(el, themeName);
    chartRef.current = chart;

    if (optionRef.current) {
      chart.setOption(optionRef.current, { notMerge: true });
    }

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [themeName]);

  // option 변경 → setOption만
  useEffect(() => {
    if (chartRef.current && option) {
      chartRef.current.setOption(option, { notMerge: true });
    }
  }, [option]);

  return { containerRef, chartRef };
}
