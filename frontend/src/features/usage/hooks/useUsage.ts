import { useQuery } from "@tanstack/react-query";
import { usageApi } from "@/lib/api/usage.api";
import { usageKeys } from "./usageKeys";

export function useUsage() {
  return useQuery({
    queryKey: usageKeys.info(),
    queryFn: () => usageApi.get(),
    staleTime: 60_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && !data.available) {
        // 429 rate limit: 서버가 알려준 retry_after(초)를 ms로 변환, 기본 5분
        if (data.retry_after) {
          return data.retry_after * 1_000;
        }
        return 5 * 60_000; // 기타 에러: 5분
      }
      return 60_000; // 정상: 60초
    },
  });
}
