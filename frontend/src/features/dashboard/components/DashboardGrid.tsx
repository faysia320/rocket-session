import { memo, useMemo, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { sortSessionsByStatus } from "@/lib/utils";
import type { SessionInfo } from "@/types";

const SessionDashboardCard = lazy(() =>
  import("@/features/session/components/SessionDashboardCard").then((m) => ({
    default: m.SessionDashboardCard,
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto p-6">
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

        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <span className="font-mono text-sm text-muted-foreground animate-pulse">
                로딩 중…
              </span>
            </div>
          }
        >
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
        </Suspense>
      </div>
    </div>
  );
});
