import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/ui/EmptyState";
import { sessionsApi } from "@/lib/api/sessions.api";
import { sessionKeys } from "@/features/session/hooks/sessionKeys";
import { useSessionStore } from "@/store";
import type { SessionInfo } from "@/types";

const DashboardGrid = lazy(() =>
  import("@/features/dashboard/components/DashboardGrid").then((m) => ({
    default: m.DashboardGrid,
  })),
);

export const Route = createFileRoute("/")({
  component: IndexPage,
});

/**
 * IndexPage: SessionLayout(부모)에서 이미 useSessions()로 세션 목록을
 * 구독(5초 폴링)하므로, 여기서는 TanStack Query 캐시만 읽어옵니다.
 * staleTime: Infinity로 설정하여 중복 fetch/polling을 방지합니다.
 */
function IndexPage() {
  const navigate = useNavigate();
  const activeSessionId = useSessionStore((s) => s.activeSessionId);

  const { data: sessions = [] } = useQuery<SessionInfo[]>({
    queryKey: sessionKeys.list(),
    queryFn: () => sessionsApi.list(),
    staleTime: Infinity, // 부모 SessionLayout이 이미 폴링 중이므로 캐시만 사용
  });

  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status !== "archived"),
    [sessions],
  );

  if (activeSessions.length === 0) {
    return (
      <div className="relative flex-1 flex flex-col">
        <EmptyState onNew={() => navigate({ to: "/session/new" })} />
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <span className="font-mono text-sm text-muted-foreground animate-pulse">
              로딩 중…
            </span>
          </div>
        }
      >
        <DashboardGrid
          sessions={activeSessions}
          activeSessionId={activeSessionId}
          onSelect={(id) => {
            navigate({ to: "/session/$sessionId", params: { sessionId: id } });
          }}
          onNew={() => navigate({ to: "/session/new" })}
        />
      </Suspense>
    </div>
  );
}
