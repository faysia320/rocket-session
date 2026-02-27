import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteErrorFallback } from "@/components/ui/RouteErrorFallback";

const GitMonitorPage = lazy(() =>
  import("@/features/git-monitor/components/GitMonitorPage").then((m) => ({
    default: m.GitMonitorPage,
  })),
);

export const Route = createFileRoute("/git-monitor")({
  component: GitMonitorPageWrapper,
  errorComponent: RouteErrorFallback,
});

function GitMonitorPageWrapper() {
  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <span className="font-mono text-sm text-muted-foreground animate-pulse">로딩 중…</span>
          </div>
        }
      >
        <GitMonitorPage />
      </Suspense>
    </div>
  );
}
