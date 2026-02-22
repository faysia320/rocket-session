import {
  createRootRoute,
  Outlet,
  useNavigate,
  useLocation,
} from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useState, lazy, Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Sidebar } from "@/features/session/components/Sidebar";
import { GlobalTopBar } from "@/features/layout/components/GlobalTopBar";

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

/**
 * RootComponent: 순수 레이아웃 쉘.
 * useSessions() 등 데이터 구독은 SessionLayout에 격리되어
 * 5초 폴링으로 세션 목록이 변경되어도 이 컴포넌트는 리렌더되지 않음.
 */
function RootComponent() {
  const location = useLocation();

  // 사이드바는 세션 영역(홈 + 세션 라우트)에서 표시
  const isSessionArea =
    location.pathname === "/" || location.pathname.startsWith("/session");

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      {/* 글로벌 Top Bar */}
      <GlobalTopBar />

      {/* 사이드바 + 콘텐츠 영역 */}
      <div className="flex flex-1 overflow-hidden">
        {isSessionArea ? <SessionLayout /> : <Outlet />}
      </div>
      <CommandPaletteProvider />
    </div>
  );
}

/**
 * SessionLayout: useSessions()를 구독하는 격리된 영역.
 * 세션 목록 폴링 변경은 이 컴포넌트 트리 내에서만 리렌더를 유발하며,
 * 부모 RootComponent(GlobalTopBar, CommandPaletteProvider 포함)에는 영향 없음.
 */
function SessionLayout() {
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
  const viewMode = useSessionStore((s) => s.viewMode);
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
  const isSessionDetailRoute =
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
    if (viewMode !== "split" || pagedSessions.length === 0) return;
    if (!pagedSessions.some((s) => s.id === focusedSessionId)) {
      setFocusedSessionId(pagedSessions[0].id);
    }
  }, [viewMode, pagedSessions, focusedSessionId, setFocusedSessionId]);

  const handleSelect = useCallback(
    (id: string) => {
      selectSession(id);
      if (viewMode === "split") {
        setFocusedSessionId(id);
        const idx = activeSessions.findIndex((s) => s.id === id);
        if (idx !== -1) {
          const targetPage = Math.floor(idx / SPLIT_PAGE_SIZE);
          if (targetPage !== splitPage) {
            setSplitPage(targetPage);
          }
        }
      }
      if (isMobile) setSidebarMobileOpen(false);
    },
    [selectSession, viewMode, setFocusedSessionId, isMobile, setSidebarMobileOpen, activeSessions, splitPage],
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

  const isSplitView = viewMode === "split";

  return (
    <>
      {isMobile ? (
        <Sheet open={sidebarMobileOpen} onOpenChange={setSidebarMobileOpen}>
          <SheetContent
            side="left"
            className="p-0 w-[280px]"
            aria-describedby={undefined}
            hideClose
          >
            <SheetTitle className="sr-only">세션 목록</SheetTitle>
            {sidebarElement}
          </SheetContent>
        </Sheet>
      ) : (
        sidebarElement
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 flex overflow-hidden transition-all duration-200 ease-in-out">
          {!isMobile && isSplitView && activeSessions.length > 0 && isSessionDetailRoute ? (
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
            isSplitView && !isMobile && totalSplitPages > 1 ? (
              <SplitViewPagination
                currentPage={splitPage}
                totalPages={totalSplitPages}
                onPageChange={setSplitPage}
              />
            ) : undefined
          }
        />
      </div>
    </>
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
