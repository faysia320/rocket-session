import { BookOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { WorkspaceInfo } from "@/types/workspace";

interface WorkspaceItemProps {
  workspace: WorkspaceInfo;
  selected: boolean;
  onSelect: () => void;
}

function WorkspaceItem({ workspace, selected, onSelect }: WorkspaceItemProps) {
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
      <div className="flex items-center gap-1.5 min-w-0">
        <BookOpen className="h-3 w-3 text-primary shrink-0" />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-mono text-xs text-foreground truncate">{workspace.name}</span>
          </TooltipTrigger>
          <TooltipContent className="font-mono text-xs">{workspace.repo_url}</TooltipContent>
        </Tooltip>
      </div>
      <div className="pl-[18px]">
        <span className="font-mono text-2xs text-muted-foreground truncate block">
          {workspace.repo_url?.replace(/^https?:\/\//, "").replace(/\.git$/, "") ?? ""}
        </span>
      </div>
    </button>
  );
}

interface KnowledgeWorkspaceListProps {
  workspaces: WorkspaceInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function KnowledgeWorkspaceList({
  workspaces,
  selectedId,
  onSelect,
}: KnowledgeWorkspaceListProps) {
  return (
    <div className="flex flex-col h-full border-r border-border w-60 shrink-0">
      <div className="flex items-center px-3 py-2 border-b border-border shrink-0">
        <span className="font-mono text-xs font-semibold text-muted-foreground">워크스페이스</span>
      </div>
      <ScrollArea className="flex-1">
        {workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <BookOpen className="h-6 w-6 text-muted-foreground/30 mb-2" />
            <span className="font-mono text-2xs text-muted-foreground">
              워크스페이스가 없습니다
            </span>
          </div>
        ) : (
          workspaces.map((ws) => (
            <WorkspaceItem
              key={ws.id}
              workspace={ws}
              selected={ws.id === selectedId}
              onSelect={() => onSelect(ws.id)}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
