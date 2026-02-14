import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSessionStore } from '@/store';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

function IndexPage() {
  const navigate = useNavigate();
  const setSidebarMobileOpen = useSessionStore((s) => s.setSidebarMobileOpen);

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
      <EmptyState onNew={() => navigate({ to: '/session/new' })} />
    </div>
  );
}
