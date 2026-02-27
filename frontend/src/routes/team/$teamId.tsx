import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const TeamDashboard = lazy(() =>
  import("@/features/team/components/TeamDashboard").then((m) => ({
    default: m.TeamDashboard,
  })),
);

export const Route = createFileRoute("/team/$teamId")({
  component: TeamPage,
});

function TeamPage() {
  const { teamId } = Route.useParams();
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <span className="font-mono text-sm text-muted-foreground animate-pulse">로딩 중…</span>
        </div>
      }
    >
      <TeamDashboard teamId={teamId} />
    </Suspense>
  );
}
