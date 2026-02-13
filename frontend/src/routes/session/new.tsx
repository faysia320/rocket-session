import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { SessionSetupPanel } from '@/features/session/components/SessionSetupPanel';
import { useCreateSession } from '@/features/session/hooks/useSessions';

export const Route = createFileRoute('/session/new')({
  component: NewSessionPage,
});

function NewSessionPage() {
  const navigate = useNavigate();
  const { createSession } = useCreateSession();

  return (
    <SessionSetupPanel
      onCreate={createSession}
      onCancel={() => navigate({ to: '/' })}
    />
  );
}
