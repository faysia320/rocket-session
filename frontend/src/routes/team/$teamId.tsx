import { createFileRoute } from "@tanstack/react-router";
import { TeamDashboard } from "@/features/team/components/TeamDashboard";

export const Route = createFileRoute("/team/$teamId")({
  component: TeamPage,
});

function TeamPage() {
  const { teamId } = Route.useParams();
  return <TeamDashboard teamId={teamId} />;
}
