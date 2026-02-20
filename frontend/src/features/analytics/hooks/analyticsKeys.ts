import type { AnalyticsPeriod } from "@/types";

export const analyticsKeys = {
  all: ["analytics"] as const,
  data: (period: AnalyticsPeriod) => [...analyticsKeys.all, period] as const,
};
