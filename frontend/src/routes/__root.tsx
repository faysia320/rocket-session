import { createRootRoute, Outlet, useNavigate, useLocation } from '@tanstack/react-router';
import { Sidebar } from '@/features/session/components/Sidebar';
import { ChatPanel } from '@/features/chat/components/ChatPanel';
import { useSessions } from '@/features/session/hooks/useSessions';
import { useSessionStore } from '@/store';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessions, activeSessionId, deleteSession, selectSession, refreshSessions } =
    useSessions();
  const splitView = useSessionStore((s) => s.splitView);
  const isNewSessionRoute = location.pathname === '/session/new';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={selectSession}
        onNew={() => navigate({ to: '/session/new' })}
        onDelete={deleteSession}
        onImported={(id) => {
          refreshSessions();
          selectSession(id);
        }}
      />
      <main className="flex-1 flex overflow-hidden transition-all duration-200 ease-in-out">
        {splitView && sessions.length > 0 && !isNewSessionRoute ? (
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
  );
}
