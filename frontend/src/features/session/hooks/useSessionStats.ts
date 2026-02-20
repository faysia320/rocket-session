import { useQuery } from "@tanstack/react-query";
import { sessionsApi } from "@/lib/api/sessions.api";
import { sessionKeys } from "./sessionKeys";
import type { SessionStats } from "@/types";

export type { SessionStats };

export function useSessionStats(sessionId: string | null) {
  return useQuery({
    queryKey: sessionKeys.stats(sessionId ?? ""),
    queryFn: () => sessionsApi.stats(sessionId!),
    enabled: !!sessionId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
