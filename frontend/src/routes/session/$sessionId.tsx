import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import { useSessionStore } from "@/store";

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
  const viewMode = useSessionStore((s) => s.viewMode);
  const setViewMode = useSessionStore((s) => s.setViewMode);

  // 세션 상세로 진입 시 dashboard 모드이면 single로 자동 전환
  useEffect(() => {
    if (viewMode === "dashboard") {
      setViewMode("single");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
