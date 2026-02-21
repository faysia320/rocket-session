import {
  createRootRoute,
  Outlet,
  useNavigate,
  useLocation,
} from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useState, lazy, Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Sidebar } from "@/features/session/components/Sidebar";

const ChatPanel = lazy(() =>
  import("@/features/chat/components/ChatPanel").then((m) => ({
    default: m.ChatPanel,
  })),
);
import { useSessions } from "@/features/session/hooks/useSessions";
import { useSessionStore } from "@/store";
import { UsageFooter } from "@/features/usage/components/UsageFooter";
import { CommandPaletteProvider } from "@/features/command-palette/components/CommandPaletteProvider";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

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
  const focusedSessionId = useSessionStore((s) => s.focusedSessionId);
  const setFocusedSessionId = useSessionStore((s) => s.setFocusedSessionId);
  const sidebarMobileOpen = useSessionStore((s) => s.sidebarMobileOpen);
  const setSidebarMobileOpen = useSessionStore((s) => s.setSidebarMobileOpen);
  const isMobile = useIsMobile();

  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status !== "archived"),
    [sessions],
  );

  // Split View는 세션 라우트(/session/:id)에서만 활성화
  const isSessionRoute =
    location.pathname.startsWith("/session/") &&
    !location.pathname.endsWith("/new");

  // split view 페이징
  const SPLIT_PAGE_SIZE = 5;
  const [splitPage, setSplitPage] = useState(0);
  const totalSplitPages = Math.ceil(activeSessions.length / SPLIT_PAGE_SIZE);

  // 세션 삭제/아카이브 시 페이지 범위 자동 보정
  useEffect(() => {
    if (splitPage >= totalSplitPages && totalSplitPages > 0) {
      setSplitPage(totalSplitPages - 1);
    }
  }, [splitPage, totalSplitPages]);

  // 현재 페이지에 표시할 세션
  const pagedSessions = useMemo(
    () =>
      activeSessions.slice(
        splitPage * SPLIT_PAGE_SIZE,
        (splitPage + 1) * SPLIT_PAGE_SIZE,
      ),
    [activeSessions, splitPage],
  );

  // 페이지 전환 시 focusedSessionId가 현재 페이지에 없으면 첫 번째 세션으로 이동
  useEffect(() => {
    if (!splitView || pagedSessions.length === 0) return;
    if (!pagedSessions.some((s) => s.id === focusedSessionId)) {
      setFocusedSessionId(pagedSessions[0].id);
    }
  }, [splitView, pagedSessions, focusedSessionId, setFocusedSessionId]);

  const handleSelect = useCallback(
    (id: string) => {
      selectSession(id);
      if (splitView) setFocusedSessionId(id);
      if (isMobile) setSidebarMobileOpen(false);
    },
    [selectSession, splitView, setFocusedSessionId, isMobile, setSidebarMobileOpen],
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
          {!isMobile && splitView && activeSessions.length > 0 && isSessionRoute ? (
            <Suspense fallback={<LoadingSkeleton />}>
              {pagedSessions.map((s) => (
                <SplitViewPane
                  key={s.id}
                  sessionId={s.id}
                  isFocused={focusedSessionId === s.id}
                  onFocus={setFocusedSessionId}
                />
              ))}
            </Suspense>
          ) : (
            <Outlet />
          )}
        </main>
        <UsageFooter
          centerSlot={
            splitView && !isMobile && totalSplitPages > 1 ? (
              <SplitViewPagination
                currentPage={splitPage}
                totalPages={totalSplitPages}
                onPageChange={setSplitPage}
              />
            ) : undefined
          }
        />
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

const SplitViewPagination = memo(function SplitViewPagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="이전 페이지"
        disabled={currentPage === 0}
        onClick={() => onPageChange(currentPage - 1)}
        className={cn(
          "inline-flex items-center justify-center w-6 h-6 rounded transition-colors",
          currentPage === 0
            ? "text-muted-foreground/40 cursor-not-allowed"
            : "text-foreground hover:bg-secondary",
        )}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <span className="font-mono text-2xs text-muted-foreground px-1 select-none">
        {currentPage + 1}/{totalPages}
      </span>
      <button
        type="button"
        aria-label="다음 페이지"
        disabled={currentPage === totalPages - 1}
        onClick={() => onPageChange(currentPage + 1)}
        className={cn(
          "inline-flex items-center justify-center w-6 h-6 rounded transition-colors",
          currentPage === totalPages - 1
            ? "text-muted-foreground/40 cursor-not-allowed"
            : "text-foreground hover:bg-secondary",
        )}
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
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
