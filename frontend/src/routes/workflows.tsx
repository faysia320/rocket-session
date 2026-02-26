import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const WorkflowDefinitionsPage = lazy(() =>
  import("@/features/workflow/components/WorkflowDefinitionsPage").then((m) => ({
    default: m.WorkflowDefinitionsPage,
  })),
);

export const Route = createFileRoute("/workflows")({
  component: WorkflowsPageWrapper,
});

function WorkflowsPageWrapper() {
  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <span className="font-mono text-sm text-muted-foreground animate-pulse">로딩 중…</span>
          </div>
        }
      >
        <WorkflowDefinitionsPage />
      </Suspense>
    </div>
  );
}
