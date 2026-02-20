import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api/analytics.api";
import { analyticsKeys } from "./analyticsKeys";
import type { AnalyticsPeriod } from "@/types";

export function useAnalytics(period: AnalyticsPeriod = "7d") {
  return useQuery({
    queryKey: analyticsKeys.data(period),
    queryFn: () => analyticsApi.get(period),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}
