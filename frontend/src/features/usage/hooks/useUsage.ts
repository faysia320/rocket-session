import { useQuery } from "@tanstack/react-query";
import { usageApi } from "@/lib/api/usage.api";
import { usageKeys } from "./usageKeys";

export function useUsage() {
  return useQuery({
    queryKey: usageKeys.info(),
    queryFn: () => usageApi.get(),
    staleTime: 60_000,
    refetchInterval: 60_000, // 60초 (백엔드 캐시 TTL과 동일)
  });
}
