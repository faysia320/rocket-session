import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const HistoryPage = lazy(() =>
  import("@/features/history/components/HistoryPage").then((m) => ({
    default: m.HistoryPage,
  })),
);

export const Route = createFileRoute("/history")({
  component: HistoryPageWrapper,
});

function HistoryPageWrapper() {
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
      <HistoryPage />
    </Suspense>
  );
}
