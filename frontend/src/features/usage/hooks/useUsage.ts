import { useQuery } from "@tanstack/react-query";
import { usageApi } from "@/lib/api/usage.api";
import { usageKeys } from "./usageKeys";

export function useUsage() {
  return useQuery({
    queryKey: usageKeys.info(),
    queryFn: () => usageApi.get(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
