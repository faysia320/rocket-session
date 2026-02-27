import { useQuery } from "@tanstack/react-query";
import { contextApi } from "@/lib/api/context.api";
import { contextKeys } from "./contextKeys";

/**
 * 워크스페이스 컨텍스트 종합 제안 훅.
 * prompt가 변경될 때마다 debounce된 상태에서 호출해야 함.
 */
export function useContextSuggestion(workspaceId: string | null, prompt?: string) {
  return useQuery({
    queryKey: contextKeys.suggest(workspaceId ?? "", prompt),
    queryFn: () => contextApi.suggest(workspaceId!, prompt),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}
