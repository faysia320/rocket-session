import {
  FolderGit2,
  GitBranch,
  AlertCircle,
  Check,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useGitInfo } from "@/features/directory/hooks/useGitInfo";

interface RepoItemProps {
  path: string;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

function getFolderName(path: string): string {
  const segments = path.replace(/\/+$/, "").split("/");
  return segments[segments.length - 1] || path;
}

function RepoItem({ path, selected, onSelect, onRemove }: RepoItemProps) {
  const { gitInfo, isLoading } = useGitInfo(path);

  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 px-3 py-2 cursor-pointer transition-colors border-l-2",
        selected
          ? "bg-muted/70 border-l-primary"
          : "hover:bg-muted/30 border-l-transparent",
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      aria-label={`저장소 ${getFolderName(path)} 선택`}
    >
      <FolderGit2 className="h-3 w-3 text-info shrink-0" />
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="font-mono text-xs text-foreground truncate flex-1">
            {getFolderName(path)}
          </span>
        </TooltipTrigger>
        <TooltipContent className="font-mono text-xs">{path}</TooltipContent>
      </Tooltip>

      {isLoading ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground shrink-0" />
      ) : gitInfo?.is_git_repo ? (
        <>
          <Badge
            variant="secondary"
            className="font-mono text-2xs px-1 py-0 shrink-0 max-w-[80px] truncate"
          >
            <GitBranch className="h-2 w-2 mr-0.5 shrink-0" />
            {gitInfo.branch ?? "?"}
          </Badge>
          {gitInfo.is_dirty ? (
            <AlertCircle className="h-2.5 w-2.5 text-warning shrink-0" />
          ) : (
            <Check className="h-2.5 w-2.5 text-success shrink-0" />
          )}
        </>
      ) : (
        <span className="font-mono text-2xs text-muted-foreground shrink-0">
          Git 아님
        </span>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label="모니터링 제거"
      >
        <X className="h-2.5 w-2.5" />
      </Button>
    </div>
  );
}

interface GitMonitorRepoListProps {
  paths: string[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onRemove: (path: string) => void;
  onAdd: () => void;
}

export function GitMonitorRepoList({
  paths,
  selectedPath,
  onSelect,
  onRemove,
  onAdd,
}: GitMonitorRepoListProps) {
  return (
    <div className="flex flex-col h-full border-r border-border w-60 shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="font-mono text-xs font-semibold text-muted-foreground">
          저장소
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onAdd}
          aria-label="저장소 추가"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        {paths.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <FolderGit2 className="h-6 w-6 text-muted-foreground/30 mb-2" />
            <span className="font-mono text-2xs text-muted-foreground">
              저장소를 추가하세요
            </span>
          </div>
        ) : (
          paths.map((path) => (
            <RepoItem
              key={path}
              path={path}
              selected={path === selectedPath}
              onSelect={() => onSelect(path)}
              onRemove={() => onRemove(path)}
            />
          ))
        )}
      </div>
    </div>
  );
}
