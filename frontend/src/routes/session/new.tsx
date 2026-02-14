import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useCreateSession } from "@/features/session/hooks/useSessions";

const SessionSetupPanel = lazy(() =>
  import("@/features/session/components/SessionSetupPanel").then((m) => ({
    default: m.SessionSetupPanel,
  })),
);

export const Route = createFileRoute("/session/new")({
  component: NewSessionPage,
});

function NewSessionPage() {
  const navigate = useNavigate();
  const { createSession } = useCreateSession();

  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <span className="font-mono text-sm text-muted-foreground animate-pulse">
            로딩 중…
          </span>
        </div>
      }
    >
      <SessionSetupPanel
        onCreate={createSession}
        onCancel={() => navigate({ to: "/" })}
      />
    </Suspense>
  );
}
