import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ChatPanel = lazy(() =>
  import("@/features/chat/components/ChatPanel").then((m) => ({
    default: m.ChatPanel,
  })),
);

export const Route = createFileRoute("/session/$sessionId")({
  component: SessionPage,
});

function SessionPage() {
  const { sessionId } = Route.useParams();

  return (
    <div className="flex flex-1 overflow-hidden">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <span className="font-mono text-sm text-muted-foreground animate-pulse">
              세션 로딩 중…
            </span>
          </div>
        }
      >
        <ChatPanel key={sessionId} sessionId={sessionId} />
      </Suspense>
    </div>
  );
}
