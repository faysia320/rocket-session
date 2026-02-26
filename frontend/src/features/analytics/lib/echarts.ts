import * as echarts from "echarts/core";
import { LineChart, BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

export { echarts };

export type { ComposeOption } from "echarts/core";
export type { LineSeriesOption, BarSeriesOption } from "echarts/charts";
export type {
  GridComponentOption,
  TooltipComponentOption,
  LegendComponentOption,
} from "echarts/components";
