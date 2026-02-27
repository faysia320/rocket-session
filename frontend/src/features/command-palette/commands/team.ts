import { Users, Plus } from "lucide-react";
import type { PaletteCommand } from "../types";
import type { TeamListItem } from "@/types";

export function createTeamCommands(deps: {
  navigate: (opts: { to: string; params?: Record<string, string> }) => void;
  teams: TeamListItem[];
}): PaletteCommand[] {
  const { navigate, teams } = deps;

  const staticCommands: PaletteCommand[] = [
    {
      id: "nav:team-home",
      label: "팀 홈",
      description: "Agent Team 대시보드",
      category: "navigation",
      icon: Users,
      action: () => navigate({ to: "/team" }),
      keywords: ["team", "팀", "agent", "에이전트", "대시보드"],
    },
    {
      id: "team:new",
      label: "새 팀 생성",
      description: "새로운 Agent Team 생성",
      category: "team",
      icon: Plus,
      action: () => navigate({ to: "/team" }),
      keywords: ["new", "create", "team", "생성", "팀", "새"],
    },
  ];

  const teamCommands: PaletteCommand[] = teams.map((t) => ({
    id: `nav:team:${t.id}`,
    label: `팀: ${t.name}`,
    description: `${t.member_count}명 멤버 (${t.status})`,
    category: "team" as const,
    icon: Users,
    action: () => navigate({ to: "/team/$teamId", params: { teamId: t.id } }),
    keywords: [t.id, t.name, "team", "팀"],
  }));

  return [...staticCommands, ...teamCommands];
}
