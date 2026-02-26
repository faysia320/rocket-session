import { useMemo } from "react";
import { useTheme } from "next-themes";

// =============================================================================
// Chart Color Resolution
// =============================================================================

function resolveHslVar(varName: string): string {
  if (typeof window === "undefined") return "hsl(0 0% 50%)";
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return raw ? `hsl(${raw})` : "hsl(0 0% 50%)";
}

export interface ChartColors {
  input: string;
  output: string;
  cacheRead: string;
  cacheWrite: string;
  research: string;
  plan: string;
  implement: string;
  review: string;
  test: string;
  grid: string;
  axisText: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipLabel: string;
}

export function useChartColors(): ChartColors {
  const { resolvedTheme } = useTheme();
  return useMemo(
    () => ({
      input: resolveHslVar("--chart-1"),
      output: resolveHslVar("--chart-3"),
      cacheRead: resolveHslVar("--chart-2"),
      cacheWrite: resolveHslVar("--chart-4"),
      research: resolveHslVar("--chart-1"),
      plan: resolveHslVar("--chart-3"),
      implement: resolveHslVar("--chart-2"),
      review: resolveHslVar("--chart-4"),
      test: resolveHslVar("--chart-5"),
      grid: resolveHslVar("--chart-grid"),
      axisText: resolveHslVar("--chart-axis-text"),
      tooltipBg: resolveHslVar("--chart-tooltip-bg"),
      tooltipBorder: resolveHslVar("--chart-tooltip-border"),
      tooltipText: resolveHslVar("--chart-tooltip-text"),
      tooltipLabel: resolveHslVar("--chart-tooltip-label"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvedTheme],
  );
}

// =============================================================================
// Shared Constants
// =============================================================================

export const CHART_FONT = {
  axisTick: 11,
  legend: 12,
  tooltip: 12,
  tooltipLabel: 13,
  family: "'JetBrains Mono', ui-monospace, monospace",
} as const;

export const CHART_DIMENSIONS = {
  areaChartHeight: 280,
  barRowHeight: 44,
  minChartHeight: 140,
  barGap: 6,
  barCategoryGap: "20%",
  yAxisWidth: { short: 56, medium: 100, long: 140 } as const,
} as const;

export const CHART_ANIMATION = {
  duration: 600,
  easing: "ease-out" as const,
  delayPerSeries: 100,
} as const;

// =============================================================================
// Axis / Grid Factory Functions
// =============================================================================

export function getXAxisProps(
  colors: ChartColors,
  overrides?: Record<string, unknown>,
) {
  return {
    tick: { fontSize: CHART_FONT.axisTick, fill: colors.axisText },
    tickLine: false,
    axisLine: false,
    ...overrides,
  };
}

export function getYAxisProps(
  colors: ChartColors,
  overrides?: Record<string, unknown>,
) {
  return {
    tick: { fontSize: CHART_FONT.axisTick, fill: colors.axisText },
    tickLine: false,
    axisLine: false,
    ...overrides,
  };
}

export function getGridProps(
  colors: ChartColors,
  overrides?: Record<string, unknown>,
) {
  return {
    strokeDasharray: "3 3",
    stroke: colors.grid,
    strokeOpacity: 0.6,
    ...overrides,
  };
}
