import { FolderGit2, GitBranch, AlertCircle, Check, Plus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { WorkspaceInfo, WorkspaceStatus } from "@/types/workspace";

const STATUS_ICON: Record<WorkspaceStatus, React.ReactNode> = {
  cloning: <Loader2 className="h-2.5 w-2.5 animate-spin text-primary shrink-0" />,
  ready: null,
  error: <AlertCircle className="h-2.5 w-2.5 text-destructive shrink-0" />,
  deleting: <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground shrink-0" />,
};

interface RepoItemProps {
  workspace: WorkspaceInfo;
  selected: boolean;
  onSelect: () => void;
}

function RepoItem({ workspace, selected, onSelect }: RepoItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "w-full flex flex-col gap-0.5 px-3 py-2 transition-colors border-l-2 text-left",
        selected ? "bg-muted/70 border-l-primary" : "hover:bg-muted/30 border-l-transparent",
      )}
      onClick={onSelect}
      aria-label={`워크스페이스 ${workspace.name} 선택`}
    >
      {/* 1행: Repo 이름 */}
      <div className="flex items-center gap-1.5 min-w-0">
        <FolderGit2 className="h-3 w-3 text-info shrink-0" />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-mono text-xs text-foreground truncate">
              {workspace.name}
            </span>
          </TooltipTrigger>
          <TooltipContent className="font-mono text-xs">{workspace.repo_url}</TooltipContent>
        </Tooltip>
      </div>

      {/* 2행: Branch + Clean 여부 */}
      <div className="flex items-center gap-1.5 pl-[18px]">
        {workspace.status === "ready" ? (
          <>
            {workspace.current_branch ? (
              <Badge
                variant="secondary"
                className="font-mono text-2xs px-1 py-0 shrink-0 max-w-[100px] truncate"
              >
                <GitBranch className="h-2 w-2 mr-0.5 shrink-0" />
                {workspace.current_branch}
              </Badge>
            ) : null}
            {workspace.is_dirty ? (
              <span className="flex items-center gap-0.5 text-2xs text-warning">
                <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                dirty
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-2xs text-success">
                <Check className="h-2.5 w-2.5 shrink-0" />
                clean
              </span>
            )}
          </>
        ) : (
          <span className="flex items-center gap-1 text-2xs text-muted-foreground">
            {STATUS_ICON[workspace.status]}
            {workspace.status}
          </span>
        )}
      </div>
    </button>
  );
}

interface GitMonitorRepoListProps {
  workspaces: WorkspaceInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function GitMonitorRepoList({
  workspaces,
  selectedId,
  onSelect,
  onAdd,
}: GitMonitorRepoListProps) {
  return (
    <div className="flex flex-col h-full border-r border-border w-60 shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="font-mono text-xs font-semibold text-muted-foreground">워크스페이스</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onAdd}
          aria-label="워크스페이스 추가"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        {workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <FolderGit2 className="h-6 w-6 text-muted-foreground/30 mb-2" />
            <span className="font-mono text-2xs text-muted-foreground">워크스페이스를 추가하세요</span>
          </div>
        ) : (
          workspaces.map((ws) => (
            <RepoItem
              key={ws.id}
              workspace={ws}
              selected={ws.id === selectedId}
              onSelect={() => onSelect(ws.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
