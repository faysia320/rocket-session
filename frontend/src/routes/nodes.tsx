import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const WorkflowNodesPage = lazy(() =>
  import("@/features/workflow/components/WorkflowNodesPage").then((m) => ({
    default: m.WorkflowNodesPage,
  })),
);

export const Route = createFileRoute("/nodes")({
  component: NodesPageWrapper,
});

function NodesPageWrapper() {
  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <span className="font-mono text-sm text-muted-foreground animate-pulse">로딩 중…</span>
          </div>
        }
      >
        <WorkflowNodesPage />
      </Suspense>
    </div>
  );
}
