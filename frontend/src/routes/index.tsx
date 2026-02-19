import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSessionStore } from "@/store";
import { useSessions } from "@/features/session/hooks/useSessions";

const SessionDashboardCard = lazy(() =>
  import("@/features/session/components/SessionDashboardCard").then((m) => ({
    default: m.SessionDashboardCard,
  })),
);

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const navigate = useNavigate();
  const setSidebarMobileOpen = useSessionStore((s) => s.setSidebarMobileOpen);
  const dashboardView = useSessionStore((s) => s.dashboardView);
  const { sessions, selectSession } = useSessions();

  const hasSessions = sessions.length > 0;

  if (!hasSessions || !dashboardView) {
    return (
      <div className="relative flex-1 flex flex-col">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 left-3 h-8 w-8 md:hidden z-10"
          onClick={() => setSidebarMobileOpen(true)}
          aria-label="메뉴 열기"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <EmptyState onNew={() => navigate({ to: "/session/new" })} />
      </div>
    );
  }

  const runningSessions = sessions.filter((s) => s.status === "running");
  const otherSessions = sessions.filter((s) => s.status !== "running");
  const sortedSessions = [...runningSessions, ...otherSessions];

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 left-3 h-8 w-8 md:hidden z-10"
        onClick={() => setSidebarMobileOpen(true)}
        aria-label="메뉴 열기"
      >
        <Menu className="h-4 w-4" />
      </Button>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-mono text-lg font-semibold text-foreground">
              Dashboard
            </h1>
            <p className="font-mono text-xs text-muted-foreground">
              {sessions.length}개 세션 ({runningSessions.length}개 실행 중)
            </p>
          </div>
          <Button
            variant="default"
            size="sm"
            className="font-mono text-xs"
            onClick={() => navigate({ to: "/session/new" })}
          >
            + New Session
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <Suspense>
            {sortedSessions.map((s) => (
              <SessionDashboardCard
                key={s.id}
                session={s}
                isActive={false}
                onSelect={selectSession}
              />
            ))}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
