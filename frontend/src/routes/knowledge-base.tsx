import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteErrorFallback } from "@/components/ui/RouteErrorFallback";

const KnowledgeBasePanel = lazy(() =>
  import("@/features/knowledge/components/KnowledgeBasePanel").then((m) => ({
    default: m.KnowledgeBasePanel,
  })),
);

export const Route = createFileRoute("/knowledge-base")({
  component: KnowledgeBasePage,
  errorComponent: RouteErrorFallback,
});

function KnowledgeBasePage() {
  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <span className="font-mono text-sm text-muted-foreground animate-pulse">
              Loading...
            </span>
          </div>
        }
      >
        <KnowledgeBasePanel />
      </Suspense>
    </div>
  );
}
