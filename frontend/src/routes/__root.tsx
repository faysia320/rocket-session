import {
  createRootRoute,
  Outlet,
  useNavigate,
  useLocation,
} from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { Sidebar } from "@/features/session/components/Sidebar";
import { ChatPanel } from "@/features/chat/components/ChatPanel";
import { SessionDashboardCard } from "@/features/session/components/SessionDashboardCard";
import { useSessions } from "@/features/session/hooks/useSessions";
import { useSessionStore } from "@/store";
import { UsageFooter } from "@/features/usage/components/UsageFooter";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { sessionsApi } from "@/lib/api/sessions.api";
import { Button } from "@/components/ui/button";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    sessions,
    activeSessionId,
    isLoading,
    isError,
    deleteSession,
    renameSession,
    selectSession,
    refreshSessions,
  } = useSessions();
  const splitView = useSessionStore((s) => s.splitView);
  const dashboardView = useSessionStore((s) => s.dashboardView);
  const sidebarMobileOpen = useSessionStore((s) => s.sidebarMobileOpen);
  const setSidebarMobileOpen = useSessionStore((s) => s.setSidebarMobileOpen);
  const isMobile = useIsMobile();
  const isNewSessionRoute = location.pathname === "/session/new";

  const handleSelect = useCallback(
    (id: string) => {
      selectSession(id);
      if (isMobile) setSidebarMobileOpen(false);
    },
    [selectSession, isMobile, setSidebarMobileOpen],
  );

  const handleNew = useCallback(() => {
    navigate({ to: "/session/new" });
    if (isMobile) setSidebarMobileOpen(false);
  }, [navigate, isMobile, setSidebarMobileOpen]);

  const handleImported = useCallback(
    (id: string) => {
      refreshSessions();
      selectSession(id);
      if (isMobile) setSidebarMobileOpen(false);
    },
    [refreshSessions, selectSession, isMobile, setSidebarMobileOpen],
  );

  const handleOpenTerminal = useCallback(async (sessionId: string) => {
    try {
      await sessionsApi.openTerminal(sessionId);
      toast.success("터미널이 열렸습니다");
    } catch {
      toast.error("터미널 열기에 실패했습니다");
    }
  }, []);

  const sidebarElement = (
    <Sidebar
      sessions={sessions}
      activeSessionId={activeSessionId}
      onSelect={handleSelect}
      onNew={handleNew}
      onDelete={deleteSession}
      onRename={renameSession}
      onImported={handleImported}
      isMobileOverlay={isMobile}
      isLoading={isLoading}
      isError={isError}
    />
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      <div className="flex flex-1 overflow-hidden">
        {isMobile ? (
          <Sheet open={sidebarMobileOpen} onOpenChange={setSidebarMobileOpen}>
            <SheetContent
              side="left"
              className="p-0 w-[280px]"
              aria-describedby={undefined}
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              {sidebarElement}
            </SheetContent>
          </Sheet>
        ) : (
          sidebarElement
        )}
        <main className="flex-1 flex overflow-hidden transition-all duration-200 ease-in-out">
          {!isMobile &&
          dashboardView &&
          sessions.length > 0 &&
          !isNewSessionRoute ? (
            <DashboardGrid
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelect={handleSelect}
              onNew={handleNew}
              onOpenTerminal={handleOpenTerminal}
            />
          ) : !isMobile &&
            splitView &&
            sessions.length > 0 &&
            !isNewSessionRoute ? (
            <>
              {sessions.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="flex-1 min-w-0 h-full flex flex-col border-r border-border last:border-r-0"
                >
                  <ChatPanel sessionId={s.id} />
                </div>
              ))}
              {sessions.length > 5 ? (
                <div className="absolute top-2 right-2 z-10">
                  <span className="font-mono text-[10px] bg-warning/15 text-warning px-2 py-0.5 rounded border border-warning/30">
                    +{sessions.length - 5} more (max 5)
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      <UsageFooter />
    </div>
  );
}

function DashboardGrid({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onOpenTerminal,
}: {
  sessions: import("@/types").SessionInfo[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onOpenTerminal: (id: string) => void;
}) {
  const runningSessions = sessions.filter((s) => s.status === "running");
  const otherSessions = sessions.filter((s) => s.status !== "running");
  const sortedSessions = [...runningSessions, ...otherSessions];

  return (
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
          onClick={onNew}
        >
          + New Session
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedSessions.map((s) => (
          <SessionDashboardCard
            key={s.id}
            session={s}
            isActive={s.id === activeSessionId}
            onSelect={onSelect}
            onOpenTerminal={onOpenTerminal}
          />
        ))}
      </div>
    </div>
  );
}
