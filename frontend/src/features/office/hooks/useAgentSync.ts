import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { sessionKeys } from "@/features/session/hooks/sessionKeys";
import { sessionsApi } from "@/lib/api/sessions.api";
import { mapSessionToAgent } from "../utils/activityMapping";
import { useOfficeStore } from "./useOfficeStore";

/**
 * 세션 목록 → 에이전트 상태 동기화.
 * 기존 sessionsApi.list() TanStack Query 캐시를 읽음 (staleTime: Infinity).
 * OfficeLayout에서 useSessions()가 폴링을 활성화하므로 중복 fetch 없음.
 */
export function useAgentSync(): void {
  const setAgents = useOfficeStore((s) => s.setAgents);

  const { data: sessions = [] } = useQuery({
    queryKey: sessionKeys.list(),
    queryFn: () => sessionsApi.list(),
    staleTime: Infinity,
  });

  useEffect(() => {
    const nonArchived = sessions.filter((s) => s.status !== "archived");
    const agents = nonArchived.map((s, i) => mapSessionToAgent(s, i));
    setAgents(agents);
  }, [sessions, setAgents]);
}
