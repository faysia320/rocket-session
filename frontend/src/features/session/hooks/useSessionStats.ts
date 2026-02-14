import { useQuery } from "@tanstack/react-query";
import { sessionsApi } from "@/lib/api/sessions.api";
import { sessionKeys } from "./sessionKeys";

export interface SessionStats {
  total_messages: number;
  total_cost: number;
  total_duration_ms: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_creation_tokens: number;
  total_cache_read_tokens: number;
}

export function useSessionStats(sessionId: string | null) {
  return useQuery({
    queryKey: sessionKeys.stats(sessionId ?? ""),
    queryFn: () => sessionsApi.stats(sessionId!),
    enabled: !!sessionId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
