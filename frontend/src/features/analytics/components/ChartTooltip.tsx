import { memo } from "react";
import type { TooltipProps } from "recharts";
import { formatTokens } from "@/lib/utils";
import { CHART_FONT } from "../lib/chartConfig";
import type { ChartColors } from "../lib/chartConfig";

interface ChartTooltipProps extends TooltipProps<number, string> {
  colors: ChartColors;
  colorMap?: Record<string, string>;
  valueFormatter?: (value: number) => string;
}

export const ChartTooltip = memo(function ChartTooltip({
  active,
  payload,
  label,
  colors,
  colorMap,
  valueFormatter = formatTokens,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        backgroundColor: colors.tooltipBg,
        border: `1px solid ${colors.tooltipBorder}`,
        borderRadius: 8,
        padding: "10px 14px",
        fontFamily: CHART_FONT.family,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      <p
        style={{
          fontSize: CHART_FONT.tooltipLabel,
          color: colors.tooltipLabel,
          fontWeight: 600,
          marginBottom: 6,
          borderBottom: `1px solid ${colors.tooltipBorder}`,
          paddingBottom: 6,
        }}
      >
        {label}
      </p>
      {payload.map((entry) => (
        <div
          key={entry.dataKey as string}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: CHART_FONT.tooltip,
            color: colors.tooltipText,
            padding: "2px 0",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor:
                colorMap?.[entry.dataKey as string] ??
                entry.color ??
                colors.tooltipText,
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1 }}>{entry.name}</span>
          <span
            style={{
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {typeof entry.value === "number"
              ? valueFormatter(entry.value)
              : String(entry.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
});
