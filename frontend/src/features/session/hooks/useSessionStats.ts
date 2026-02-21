import { useQuery } from "@tanstack/react-query";
import { sessionsApi } from "@/lib/api/sessions.api";
import { sessionKeys } from "./sessionKeys";
import type { SessionStats } from "@/types";

export type { SessionStats };

export function useSessionStats(sessionId: string | null, isRunning = false) {
  return useQuery({
    queryKey: sessionKeys.stats(sessionId ?? ""),
    queryFn: () => sessionsApi.stats(sessionId!),
    enabled: !!sessionId,
    staleTime: 30_000,
    // running 상태에서만 60초 polling, idle 시 비활성화
    refetchInterval: isRunning ? 60_000 : false,
  });
}
