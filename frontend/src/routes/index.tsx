import { createFileRoute } from '@tanstack/react-router';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSessions } from '@/features/session/hooks/useSessions';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

function IndexPage() {
  const { createSession } = useSessions();

  return <EmptyState onNew={() => createSession()} />;
}
