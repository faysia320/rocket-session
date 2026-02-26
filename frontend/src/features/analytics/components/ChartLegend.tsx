import { memo } from "react";
import type { Payload } from "recharts/types/component/DefaultLegendContent";
import { CHART_FONT } from "../lib/chartConfig";
import type { ChartColors } from "../lib/chartConfig";

interface ChartLegendProps {
  payload?: Payload[];
  colors: ChartColors;
}

export const ChartLegend = memo(function ChartLegend({
  payload,
  colors,
}: ChartLegendProps) {
  if (!payload?.length) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "12px 16px",
        padding: "8px 0 0",
        fontFamily: CHART_FONT.family,
        fontSize: CHART_FONT.legend,
      }}
    >
      {payload.map((entry) => (
        <div
          key={entry.value}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: colors.axisText,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: entry.color,
              flexShrink: 0,
            }}
          />
          <span>{entry.value}</span>
        </div>
      ))}
    </div>
  );
});
