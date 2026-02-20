import { useState } from "react";
import { ChevronDown, ChevronRight, GitBranch, Star } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useWorktrees } from "../hooks/useWorktrees";

interface WorktreePanelProps {
  repoPath: string;
  onChange: (path: string) => void;
}

export function WorktreePanel({ repoPath, onChange }: WorktreePanelProps) {
  const { worktrees, isLoading } = useWorktrees(repoPath);
  const [expanded, setExpanded] = useState(false);

  if (isLoading || worktrees.length === 0) return null;

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setExpanded((p) => !p)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <GitBranch className="h-3 w-3 text-info" />
        <span className="font-mono text-2xs font-semibold text-muted-foreground">
          Worktrees ({worktrees.length})
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-border px-1 py-1 space-y-0.5">
          {worktrees.map((wt) => (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  key={wt.path}
                  type="button"
                  className="w-full flex items-center gap-1.5 px-2 py-1 rounded-sm hover:bg-muted text-left"
                  onClick={() => onChange(wt.path)}
                >
                  {wt.is_main ? (
                    <Star className="h-2.5 w-2.5 text-warning shrink-0" />
                  ) : (
                    <div className="w-2.5" />
                  )}
                  <span className="font-mono text-2xs text-muted-foreground truncate flex-1">
                    {wt.path}
                  </span>
                  <span className="font-mono text-2xs text-info shrink-0">
                    ({wt.branch ?? "detached"})
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="font-mono text-xs">{wt.path}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
