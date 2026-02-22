import { memo, useMemo, lazy, Suspense } from "react";
import { GitBranch, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { sortSessionsByStatus } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMediaQuery";
import type { SessionInfo } from "@/types";

const SessionDashboardCard = lazy(() =>
  import("@/features/session/components/SessionDashboardCard").then((m) => ({
    default: m.SessionDashboardCard,
  })),
);
const GitMonitorPanel = lazy(() =>
  import("@/features/git-monitor/components/GitMonitorPanel").then((m) => ({
    default: m.GitMonitorPanel,
  })),
);

interface DashboardGridProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export const DashboardGrid = memo(function DashboardGrid({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
}: DashboardGridProps) {
  const sortedSessions = useMemo(
    () => sortSessionsByStatus(sessions),
    [sessions],
  );
  const runningCount = useMemo(
    () => sessions.filter((s) => s.status === "running").length,
    [sessions],
  );
  const isMobile = useIsMobile();

  const sessionHeader = (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h1 className="font-mono text-lg font-semibold text-foreground">
          Dashboard
        </h1>
        <p className="font-mono text-xs text-muted-foreground">
          {sessions.length}개 세션 ({runningCount}개 실행 중)
        </p>
      </div>
      <Button
        variant="default"
        size="sm"
        className="font-mono text-xs"
        onClick={onNew}
      >
        + New Session
      </Button>
    </div>
  );

  const sessionCards = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {sortedSessions.map((s) => (
        <SessionDashboardCard
          key={s.id}
          session={s}
          isActive={s.id === activeSessionId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );

  const gitMonitorFallback = (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <span className="font-mono text-sm text-muted-foreground animate-pulse">
        로딩 중…
      </span>
    </div>
  );

  if (isMobile) {
    return (
      <Tabs
        defaultValue="sessions"
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-4 pt-3 shrink-0">
          <TabsList className="w-full">
            <TabsTrigger
              value="sessions"
              className="flex-1 gap-1.5 font-mono text-xs"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Sessions
            </TabsTrigger>
            <TabsTrigger
              value="git"
              className="flex-1 gap-1.5 font-mono text-xs"
            >
              <GitBranch className="h-3.5 w-3.5" />
              Git Monitor
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="sessions"
          className="flex-1 overflow-auto m-0 px-4 py-3"
        >
          {sessionHeader}
          {sessionCards}
        </TabsContent>

        <TabsContent value="git" className="flex-1 overflow-hidden m-0">
          <Suspense fallback={gitMonitorFallback}>
            <GitMonitorPanel />
          </Suspense>
        </TabsContent>
      </Tabs>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 상단: 세션 카드 그리드 (40%) */}
      <div className="flex-[2] min-h-0 overflow-auto p-6">
        {sessionHeader}
        {sessionCards}
      </div>

      {/* 하단: Git Monitor (60%) */}
      <Suspense fallback={gitMonitorFallback}>
        <div className="flex-[3] min-h-0 overflow-hidden">
          <GitMonitorPanel />
        </div>
      </Suspense>
    </div>
  );
});
