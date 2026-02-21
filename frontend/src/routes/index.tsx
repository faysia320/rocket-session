import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSessionStore } from "@/store";
import { useSessions } from "@/features/session/hooks/useSessions";

const DashboardGrid = lazy(() =>
  import("@/features/dashboard/components/DashboardGrid").then((m) => ({
    default: m.DashboardGrid,
  })),
);

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const navigate = useNavigate();
  const setSidebarMobileOpen = useSessionStore((s) => s.setSidebarMobileOpen);
  const { sessions, activeSessionId, selectSession } = useSessions();

  const activeSessions = sessions.filter((s) => s.status !== "archived");

  if (activeSessions.length === 0) {
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
            selectSession(id);
            navigate({ to: "/session/$sessionId", params: { sessionId: id } });
          }}
          onNew={() => navigate({ to: "/session/new" })}
        />
      </Suspense>
    </div>
  );
}
