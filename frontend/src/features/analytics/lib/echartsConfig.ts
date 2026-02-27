// =============================================================================
// Shared Constants (기존 chartConfig.ts에서 유지)
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
  easing: "cubicOut" as const,
  delayPerSeries: 100,
} as const;

// =============================================================================
// ECharts Option Factories
// =============================================================================

export function getBaseAxis(overrides?: Record<string, unknown>) {
  return {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      fontSize: CHART_FONT.axisTick,
      fontFamily: CHART_FONT.family,
    },
    ...overrides,
  };
}

export function getBaseGrid(overrides?: Record<string, unknown>) {
  return {
    left: 56,
    right: 16,
    top: 52,
    bottom: 40,
    containLabel: false,
    ...overrides,
  };
}

export function getBaseTooltip(overrides?: Record<string, unknown>) {
  return {
    borderWidth: 1,
    borderRadius: 8,
    padding: [10, 14],
    textStyle: {
      fontFamily: CHART_FONT.family,
      fontSize: CHART_FONT.tooltip,
    },
    extraCssText: "box-shadow: 0 4px 12px rgba(0,0,0,0.15);",
    ...overrides,
  };
}

export function getBaseLegend(overrides?: Record<string, unknown>) {
  return {
    top: 4,
    left: "center",
    textStyle: {
      fontFamily: CHART_FONT.family,
      fontSize: CHART_FONT.legend,
    },
    itemWidth: 12,
    itemHeight: 12,
    itemGap: 16,
    ...overrides,
  };
}

export const CHART_LABEL = {
  fontSize: 11,
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontWeight: 500 as const,
} as const;

export function getSplitLineStyle() {
  return {
    lineStyle: {
      type: "dashed" as const,
      opacity: 0.6,
    },
  };
}
