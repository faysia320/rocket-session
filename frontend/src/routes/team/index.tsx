import { createFileRoute } from "@tanstack/react-router";
import { TeamListPage } from "@/features/team/components/TeamListPage";

export const Route = createFileRoute("/team/")({
  component: TeamListPage,
});
