import {
  GitBranch,
  Check,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { GitInfo } from "@/types";

interface GitInfoCardProps {
  gitInfo: GitInfo;
}

export function GitInfoCard({ gitInfo }: GitInfoCardProps) {
  if (!gitInfo.is_git_repo) return null;

  return (
    <div className="flex flex-col gap-1 px-2.5 py-2 bg-card/50 border border-border rounded-md">
      <div className="flex items-center gap-1.5 flex-wrap">
        <GitBranch className="h-3 w-3 text-info shrink-0" />
        <Badge
          variant="secondary"
          className="font-mono text-2xs px-1.5 py-0"
        >
          {gitInfo.branch ?? "detached"}
        </Badge>
        {gitInfo.is_dirty ? (
          <span className="flex items-center gap-0.5 text-warning">
            <AlertCircle className="h-2.5 w-2.5" />
            <span className="font-mono text-2xs">dirty</span>
          </span>
        ) : (
          <span className="flex items-center gap-0.5 text-success">
            <Check className="h-2.5 w-2.5" />
            <span className="font-mono text-2xs">clean</span>
          </span>
        )}
        {gitInfo.ahead > 0 ? (
          <span className="flex items-center gap-0.5 font-mono text-2xs text-info">
            <ArrowUp className="h-2.5 w-2.5" />
            {gitInfo.ahead}
          </span>
        ) : null}
        {gitInfo.behind > 0 ? (
          <span className="flex items-center gap-0.5 font-mono text-2xs text-warning">
            <ArrowDown className="h-2.5 w-2.5" />
            {gitInfo.behind}
          </span>
        ) : null}
      </div>
      {gitInfo.last_commit_message ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="font-mono text-2xs text-muted-foreground truncate flex items-center gap-1">
              <FileText className="h-2.5 w-2.5 inline shrink-0" />
              {gitInfo.last_commit_message}
            </div>
          </TooltipTrigger>
          <TooltipContent className="font-mono text-xs">{gitInfo.last_commit_message}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
