import { formatTokens } from "@/lib/utils";
import { CHART_FONT } from "./echartsConfig";

interface TooltipParam {
  marker: string;
  seriesName: string;
  value: number | number[];
  axisValueLabel?: string;
  name?: string;
}

export function tokenTooltipFormatter(params: TooltipParam | TooltipParam[]): string {
  const list = Array.isArray(params) ? params : [params];
  if (list.length === 0) return "";

  const label = list[0].axisValueLabel ?? list[0].name ?? "";

  const header = `<div style="font-size:${CHART_FONT.tooltipLabel}px;font-weight:600;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(128,128,128,0.3);font-family:${CHART_FONT.family}">${label}</div>`;

  const rows = list
    .map((p) => {
      const val = Array.isArray(p.value) ? p.value[0] : p.value;
      return `<div style="display:flex;align-items:center;gap:8px;padding:2px 0;font-family:${CHART_FONT.family};font-size:${CHART_FONT.tooltip}px">${p.marker}<span style="flex:1">${p.seriesName}</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${typeof val === "number" ? formatTokens(val) : String(val ?? 0)}</span></div>`;
    })
    .join("");

  return header + rows;
}
