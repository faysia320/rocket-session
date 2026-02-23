import { memo, useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TeamListItem } from "@/types";

interface TeamSidebarGroupProps {
  team: TeamListItem;
  collapsed?: boolean;
}

export const TeamSidebarGroup = memo(function TeamSidebarGroup({
  team,
  collapsed,
}: TeamSidebarGroupProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(true);
  const isActive = location.pathname === `/team/${team.id}`;

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full flex items-center justify-center py-2.5 rounded-sm mb-1 transition-colors border border-transparent",
              isActive && "bg-muted border-[hsl(var(--border-bright))]",
            )}
            onClick={() => navigate({ to: "/team/$teamId", params: { teamId: team.id } })}
            aria-label={`팀 ${team.name}`}
          >
            <Users className="h-3.5 w-3.5 text-primary/70" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-mono text-xs">
          <p className="font-semibold">{team.name}</p>
          <p className="text-muted-foreground">{team.member_count} 멤버</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="mb-1">
      <button
        type="button"
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-sm hover:bg-muted/50 transition-colors text-left",
          isActive && "bg-muted",
        )}
        onClick={() => navigate({ to: "/team/$teamId", params: { teamId: team.id } })}
      >
        <button
          type="button"
          className="shrink-0 p-0.5"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          aria-label={expanded ? "접기" : "펼치기"}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
        <Users className="h-3.5 w-3.5 text-primary/70 shrink-0" />
        <span className="font-mono text-xs font-medium truncate flex-1">{team.name}</span>
        <Badge variant="secondary" className="font-mono text-2xs shrink-0">
          {team.member_count}
        </Badge>
      </button>
    </div>
  );
});
