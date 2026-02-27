import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteErrorFallback } from "@/components/ui/RouteErrorFallback";

const TeamListPage = lazy(() =>
  import("@/features/team/components/TeamListPage").then((m) => ({
    default: m.TeamListPage,
  })),
);

export const Route = createFileRoute("/team/")({
  component: TeamIndexPage,
  errorComponent: RouteErrorFallback,
});

function TeamIndexPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <span className="font-mono text-sm text-muted-foreground animate-pulse">로딩 중…</span>
        </div>
      }
    >
      <TeamListPage />
    </Suspense>
  );
}
