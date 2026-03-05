import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/ui/EmptyState";
import { sessionsApi } from "@/lib/api/sessions.api";
import { sessionKeys } from "@/features/session/hooks/sessionKeys";
import { useSessionStore } from "@/store";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { SessionInfo } from "@/types";

const DashboardGrid = lazy(() =>
  import("@/features/dashboard/components/DashboardGrid").then((m) => ({
    default: m.DashboardGrid,
  })),
);

const HistoryPage = lazy(() =>
  import("@/features/history/components/HistoryPage").then((m) => ({
    default: m.HistoryPage,
  })),
);

export const Route = createFileRoute("/")({
  component: IndexPage,
});

const LoadingFallback = () => (
  <div className="flex-1 flex items-center justify-center">
    <span className="font-mono text-sm text-muted-foreground animate-pulse">로딩 중…</span>
  </div>
);

/**
 * IndexPage: SessionLayout(부모)에서 이미 useSessions()로 세션 목록을
 * 구독(5초 폴링)하므로, 여기서는 TanStack Query 캐시만 읽어옵니다.
 * staleTime: Infinity로 설정하여 중복 fetch/polling을 방지합니다.
 */
function IndexPage() {
  const navigate = useNavigate();
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const isMobile = useIsMobile();

  const { data: sessions = [] } = useQuery<SessionInfo[]>({
    queryKey: sessionKeys.list(),
    queryFn: () => sessionsApi.list(),
    staleTime: Infinity, // 부모 SessionLayout이 이미 폴링 중이므로 캐시만 사용
  });

  const activeSessions = useMemo(() => sessions.filter((s) => s.status !== "archived"), [sessions]);

  const handleSelect = (id: string) => {
    navigate({ to: "/session/$sessionId", params: { sessionId: id } });
  };
  const handleNew = () => navigate({ to: "/session/new" });

  // Empty state: 탭 없이 기존 레이아웃 유지
  if (activeSessions.length === 0) {
    return (
      <div className="relative flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0">
          <EmptyState onNew={handleNew} />
        </div>
        <div className="shrink-0 border-t border-border" />
        <Suspense fallback={<LoadingFallback />}>
          <HistoryPage className="flex-1 min-h-0" />
        </Suspense>
      </div>
    );
  }

  // 모바일: 탭 레이아웃
  if (isMobile) {
    return (
      <Tabs defaultValue="dashboard" className="relative flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 w-full rounded-none border-b border-border bg-background h-10 p-0">
          <TabsTrigger
            value="dashboard"
            className="flex-1 rounded-none font-mono text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary"
          >
            세션 현황
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="flex-1 rounded-none font-mono text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary"
          >
            히스토리
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="flex-1 overflow-hidden m-0">
          <Suspense fallback={<LoadingFallback />}>
            <DashboardGrid
              sessions={activeSessions}
              activeSessionId={activeSessionId}
              onSelect={handleSelect}
              onNew={handleNew}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-hidden m-0">
          <Suspense fallback={<LoadingFallback />}>
            <HistoryPage className="flex-1 min-h-0" />
          </Suspense>
        </TabsContent>
      </Tabs>
    );
  }

  // 데스크톱: 기존 세로 스택 레이아웃
  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={<LoadingFallback />}>
          <DashboardGrid
            sessions={activeSessions}
            activeSessionId={activeSessionId}
            onSelect={handleSelect}
            onNew={handleNew}
          />
        </Suspense>
      </div>
      <div className="shrink-0 border-t border-border" />
      <Suspense fallback={<LoadingFallback />}>
        <HistoryPage className="flex-1 min-h-0" />
      </Suspense>
    </div>
  );
}
