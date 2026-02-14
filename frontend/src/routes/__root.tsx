import { createRootRoute, Outlet, useNavigate, useLocation } from '@tanstack/react-router';
import { Sidebar } from '@/features/session/components/Sidebar';
import { ChatPanel } from '@/features/chat/components/ChatPanel';
import { useSessions } from '@/features/session/hooks/useSessions';
import { useSessionStore } from '@/store';
import { UsageFooter } from '@/features/usage/components/UsageFooter';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useCallback } from 'react';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessions, activeSessionId, isLoading, isError, deleteSession, renameSession, selectSession, refreshSessions } =
    useSessions();
  const splitView = useSessionStore((s) => s.splitView);
  const sidebarMobileOpen = useSessionStore((s) => s.sidebarMobileOpen);
  const setSidebarMobileOpen = useSessionStore((s) => s.setSidebarMobileOpen);
  const isMobile = useIsMobile();
  const isNewSessionRoute = location.pathname === '/session/new';

  const handleSelect = useCallback((id: string) => {
    selectSession(id);
    if (isMobile) setSidebarMobileOpen(false);
  }, [selectSession, isMobile, setSidebarMobileOpen]);

  const handleNew = useCallback(() => {
    navigate({ to: '/session/new' });
    if (isMobile) setSidebarMobileOpen(false);
  }, [navigate, isMobile, setSidebarMobileOpen]);

  const handleImported = useCallback((id: string) => {
    refreshSessions();
    selectSession(id);
    if (isMobile) setSidebarMobileOpen(false);
  }, [refreshSessions, selectSession, isMobile, setSidebarMobileOpen]);

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
            <SheetContent side="left" className="p-0 w-[280px]" aria-describedby={undefined}>
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              {sidebarElement}
            </SheetContent>
          </Sheet>
        ) : (
          sidebarElement
        )}
        <main className="flex-1 flex overflow-hidden transition-all duration-200 ease-in-out">
          {!isMobile && splitView && sessions.length > 0 && !isNewSessionRoute ? (
            sessions.map((s) => (
              <div
                key={s.id}
                className="flex-1 min-w-0 h-full flex flex-col border-r border-border last:border-r-0"
              >
                <ChatPanel sessionId={s.id} />
              </div>
            ))
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      <UsageFooter />
    </div>
  );
}
