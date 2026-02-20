import { api } from "./client";
import type { AnalyticsPeriod, AnalyticsResponse } from "@/types";

export const analyticsApi = {
  get: (period: AnalyticsPeriod = "7d") =>
    api.get<AnalyticsResponse>(`/api/analytics/?period=${period}`),
};
