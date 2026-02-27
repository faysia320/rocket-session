import { memo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TeamStatusBar } from "./TeamStatusBar";
import type { TeamListItem } from "@/types";

interface TeamCardProps {
  team: TeamListItem;
  isActive: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  active: "bg-success",
  completed: "bg-info",
  paused: "bg-warning",
  archived: "bg-muted-foreground/40",
};

export const TeamCard = memo(function TeamCard({ team, isActive }: TeamCardProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className={cn(
        "w-full text-left bg-card border border-border rounded-lg p-4 transition-colors hover:border-primary/30",
        isActive && "border-primary/50 bg-muted",
      )}
      onClick={() => navigate({ to: "/team/$teamId", params: { teamId: team.id } })}
    >
      <div className="flex items-center gap-2 mb-2">
        <Users className="h-4 w-4 text-primary/70 shrink-0" />
        <span className="font-mono text-sm font-semibold truncate flex-1">{team.name}</span>
        <Badge variant="outline" className="font-mono text-2xs shrink-0">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full mr-1.5",
              STATUS_COLOR[team.status] ?? "bg-muted-foreground",
            )}
          />
          {team.status}
        </Badge>
      </div>

      {team.description ? (
        <p className="font-mono text-xs text-muted-foreground mb-3 line-clamp-2">
          {team.description}
        </p>
      ) : null}

      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono text-2xs text-muted-foreground">{team.member_count}명 멤버</span>
        <span className="font-mono text-2xs text-muted-foreground/70">{"·"}</span>
        <span className="font-mono text-2xs text-muted-foreground">
          {team.task_summary.total}개 태스크
        </span>
      </div>

      <TeamStatusBar taskSummary={team.task_summary} />
    </button>
  );
});
