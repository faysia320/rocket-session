/**
 * 세션 검색/필터 TanStack Query 훅.
 */
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { sessionsApi, type SearchSessionsParams } from "@/lib/api/sessions.api";

export const historyKeys = {
  all: ["history"] as const,
  search: (params: SearchSessionsParams) =>
    [...historyKeys.all, "search", params] as const,
};

export function useSessionSearch(params: SearchSessionsParams) {
  return useQuery({
    queryKey: historyKeys.search(params),
    queryFn: () => sessionsApi.search(params),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}
