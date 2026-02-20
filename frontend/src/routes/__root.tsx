import {
  createRootRoute,
  Outlet,
  useNavigate,
  useLocation,
} from "@tanstack/react-router";
import { memo, useCallback, useMemo, lazy, Suspense } from "react";
import { Sidebar } from "@/features/session/components/Sidebar";

const ChatPanel = lazy(() =>
  import("@/features/chat/components/ChatPanel").then((m) => ({
    default: m.ChatPanel,
  })),
);
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
import { useSessions } from "@/features/session/hooks/useSessions";
import { useSessionStore } from "@/store";
import { UsageFooter } from "@/features/usage/components/UsageFooter";
import { CommandPaletteProvider } from "@/features/command-palette/components/CommandPaletteProvider";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn, sortSessionsByStatus } from "@/lib/utils";

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
  const focusedSessionId = useSessionStore((s) => s.focusedSessionId);
  const setFocusedSessionId = useSessionStore((s) => s.setFocusedSessionId);
  const sidebarMobileOpen = useSessionStore((s) => s.sidebarMobileOpen);
  const setSidebarMobileOpen = useSessionStore((s) => s.setSidebarMobileOpen);
  const setDashboardView = useSessionStore((s) => s.setDashboardView);
  const isMobile = useIsMobile();
  const isNewSessionRoute = location.pathname === "/session/new";
  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status !== "archived"),
    [sessions],
  );

  const handleSelect = useCallback(
    (id: string) => {
      selectSession(id);
      if (splitView) setFocusedSessionId(id);
      if (dashboardView) setDashboardView(false);
      if (isMobile) setSidebarMobileOpen(false);
    },
    [selectSession, splitView, setFocusedSessionId, dashboardView, setDashboardView, isMobile, setSidebarMobileOpen],
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
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {isMobile ? (
        <Sheet open={sidebarMobileOpen} onOpenChange={setSidebarMobileOpen}>
          <SheetContent
            side="left"
            className="p-0 w-[280px]"
            aria-describedby={undefined}
            hideClose
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {sidebarElement}
          </SheetContent>
        </Sheet>
      ) : (
        sidebarElement
      )}
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 flex overflow-hidden transition-all duration-200 ease-in-out">
          {!isMobile &&
          dashboardView &&
          activeSessions.length > 0 &&
          !isNewSessionRoute ? (
            <Suspense fallback={<LoadingSkeleton />}>
              <DashboardGrid
                sessions={activeSessions}
                activeSessionId={activeSessionId}
                onSelect={handleSelect}
                onNew={handleNew}
              />
            </Suspense>
          ) : !isMobile &&
            splitView &&
            activeSessions.length > 0 &&
            !isNewSessionRoute ? (
            <Suspense fallback={<LoadingSkeleton />}>
              {activeSessions.slice(0, 5).map((s) => (
                <SplitViewPane
                  key={s.id}
                  sessionId={s.id}
                  isFocused={focusedSessionId === s.id}
                  onFocus={setFocusedSessionId}
                />
              ))}
              {activeSessions.length > 5 ? (
                <div className="absolute top-2 right-2 z-10">
                  <span className="font-mono text-2xs bg-warning/15 text-warning px-2 py-0.5 rounded border border-warning/30">
                    +{activeSessions.length - 5} more (max 5)
                  </span>
                </div>
              ) : null}
            </Suspense>
          ) : (
            <Outlet />
          )}
        </main>
        <UsageFooter />
      </div>
      <CommandPaletteProvider />
    </div>
  );
}

const SplitViewPane = memo(function SplitViewPane({
  sessionId,
  isFocused,
  onFocus,
}: {
  sessionId: string;
  isFocused: boolean;
  onFocus: (id: string) => void;
}) {
  const navigate = useNavigate();
  const handlePointerDown = useCallback(() => {
    onFocus(sessionId);
    navigate({ to: "/session/$sessionId", params: { sessionId } });
  }, [sessionId, onFocus, navigate]);

  return (
    <div
      onPointerDown={handlePointerDown}
      className="flex-1 min-w-0 h-full flex flex-col border-r border-border last:border-r-0"
    >
      <div
        className={cn(
          "h-0.5 shrink-0 transition-colors duration-200",
          isFocused ? "bg-primary" : "bg-secondary",
        )}
      />
      <ChatPanel sessionId={sessionId} />
    </div>
  );
});

const DashboardGrid = memo(function DashboardGrid({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
}: {
  sessions: import("@/types").SessionInfo[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const sortedSessions = sortSessionsByStatus(sessions);
  const runningCount = sessions.filter((s) => s.status === "running").length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 상단: 세션 카드 그리드 (60%) */}
      <div className="flex-[3] min-h-0 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
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
      </div>

      {/* 하단: Git Monitor (40%) */}
      <Suspense fallback={<LoadingSkeleton />}>
        <div className="flex-[2] min-h-0 overflow-hidden">
          <GitMonitorPanel />
        </div>
      </Suspense>
    </div>
  );
});

function LoadingSkeleton() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <span className="font-mono text-sm text-muted-foreground animate-pulse">
        로딩 중…
      </span>
    </div>
  );
}
