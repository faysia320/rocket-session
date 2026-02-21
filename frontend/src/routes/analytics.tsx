import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const AnalyticsDashboard = lazy(() =>
  import("@/features/analytics/components/AnalyticsDashboard").then((m) => ({
    default: m.AnalyticsDashboard,
  })),
);

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <span className="font-mono text-sm text-muted-foreground animate-pulse">
              로딩 중…
            </span>
          </div>
        }
      >
        <AnalyticsDashboard />
      </Suspense>
    </div>
  );
}
