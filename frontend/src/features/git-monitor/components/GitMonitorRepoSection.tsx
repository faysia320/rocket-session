import {
  GitBranch,
  AlertCircle,
  Check,
  RefreshCw,
  X,
  Loader2,
  FolderGit2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useGitInfo } from "@/features/directory/hooks/useGitInfo";
import { useGitStatus } from "../hooks/useGitStatus";
import { GitInfoCard } from "@/features/directory/components/GitInfoCard";
import { GitStatusFileList } from "./GitStatusFileList";

interface GitMonitorRepoSectionProps {
  path: string;
  defaultOpen?: boolean;
  onRemove: (path: string) => void;
}

function getFolderName(path: string): string {
  const segments = path.replace(/\/+$/, "").split("/");
  return segments[segments.length - 1] || path;
}

export function GitMonitorRepoSection({
  path,
  onRemove,
}: GitMonitorRepoSectionProps) {
  const { gitInfo, isLoading: gitInfoLoading } = useGitInfo(path);
  const {
    data: status,
    isLoading: statusLoading,
    refetch,
  } = useGitStatus(path);

  const isGitRepo = gitInfo?.is_git_repo ?? false;
  const isLoading = gitInfoLoading || statusLoading;
  const changeCount = status?.total_count ?? 0;

  return (
    <div className="flex flex-col h-full min-w-[280px] w-[320px] shrink-0 border-r border-border last:border-r-0">
      {/* 저장소 헤더 */}
      <div className="group flex items-center gap-1.5 px-3 py-2 border-b border-border shrink-0">
        <FolderGit2 className="h-3 w-3 text-info shrink-0" />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-mono text-xs font-semibold text-foreground truncate">
              {getFolderName(path)}
            </span>
          </TooltipTrigger>
          <TooltipContent className="font-mono text-xs">
            {path}
          </TooltipContent>
        </Tooltip>

        {isGitRepo ? (
          <>
            <Badge
              variant="secondary"
              className="font-mono text-2xs px-1.5 py-0 shrink-0"
            >
              <GitBranch className="h-2.5 w-2.5 mr-0.5" />
              {gitInfo?.branch ?? "detached"}
            </Badge>
            {gitInfo?.is_dirty ? (
              <AlertCircle className="h-2.5 w-2.5 text-warning shrink-0" />
            ) : (
              <Check className="h-2.5 w-2.5 text-success shrink-0" />
            )}
            {gitInfo?.ahead && gitInfo.ahead > 0 ? (
              <span className="flex items-center gap-0.5 font-mono text-2xs text-info shrink-0">
                <ArrowUp className="h-2.5 w-2.5" />
                {gitInfo.ahead}
              </span>
            ) : null}
            {gitInfo?.behind && gitInfo.behind > 0 ? (
              <span className="flex items-center gap-0.5 font-mono text-2xs text-warning shrink-0">
                <ArrowDown className="h-2.5 w-2.5" />
                {gitInfo.behind}
              </span>
            ) : null}
            {changeCount > 0 ? (
              <Badge variant="secondary" className="font-mono text-2xs px-1 py-0 shrink-0">
                {changeCount}
              </Badge>
            ) : null}
          </>
        ) : gitInfoLoading ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground shrink-0" />
        ) : (
          <span className="font-mono text-2xs text-muted-foreground shrink-0">
            Git 저장소 아님
          </span>
        )}

        <div className="flex-1" />

        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
        ) : null}

        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => refetch()}
          aria-label="새로고침"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(path)}
          aria-label="모니터링 제거"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* 저장소 콘텐츠 (항상 표시) */}
      <div className="flex-1 min-h-0 overflow-auto px-3 py-2 space-y-1">
        {isGitRepo && gitInfo ? (
          <>
            <GitInfoCard gitInfo={gitInfo} />
            {status ? (
              <GitStatusFileList repoPath={path} files={status.files} />
            ) : statusLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : null}
          </>
        ) : !gitInfoLoading ? (
          <div className="font-mono text-xs text-muted-foreground py-2 px-2">
            이 디렉토리는 Git 저장소가 아닙니다
          </div>
        ) : null}
      </div>
    </div>
  );
}
