import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { EmptyState } from '@/components/ui/EmptyState';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

function IndexPage() {
  const navigate = useNavigate();

  return <EmptyState onNew={() => navigate({ to: '/session/new' })} />;
}
