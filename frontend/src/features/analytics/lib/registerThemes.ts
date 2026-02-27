import { echarts } from "./echarts";
import purplePassionRaw from "./themes/purple-passion.json";
import romaRaw from "./themes/roma.json";

echarts.registerTheme("purple-passion", purplePassionRaw.theme);
echarts.registerTheme("roma", romaRaw.theme);
