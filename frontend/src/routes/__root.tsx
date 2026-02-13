import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Sidebar } from '@/features/session/components/Sidebar';
import { useSessions } from '@/features/session/hooks/useSessions';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const { sessions, activeSessionId, createSession, deleteSession, selectSession } =
    useSessions();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={selectSession}
        onNew={createSession}
        onDelete={deleteSession}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
