import { GitBranch, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store";
import { useGitInfo } from "@/features/directory/hooks/useGitInfo";
import { GitInfoCard } from "@/features/directory/components/GitInfoCard";
import { useGitStatus } from "../hooks/useGitStatus";
import { GitRepoSelector } from "./GitRepoSelector";
import { GitStatusFileList } from "./GitStatusFileList";

export function GitMonitorPanel() {
  const gitMonitorPath = useSessionStore((s) => s.gitMonitorPath);
  const setGitMonitorPath = useSessionStore((s) => s.setGitMonitorPath);
  const { gitInfo } = useGitInfo(gitMonitorPath);
  const {
    data: status,
    isLoading: statusLoading,
    refetch,
  } = useGitStatus(gitMonitorPath);

  return (
    <div className="flex flex-col h-full overflow-hidden border-t border-border">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <GitBranch className="h-3.5 w-3.5 text-info shrink-0" />
        <span className="font-mono text-xs font-semibold text-foreground shrink-0">
          Git Monitor
        </span>
        {status && status.total_count > 0 ? (
          <Badge variant="secondary" className="font-mono text-2xs">
            {status.total_count}개 변경
          </Badge>
        ) : null}
        <div className="flex-1" />
        <GitRepoSelector value={gitMonitorPath} onChange={setGitMonitorPath} />
        {gitMonitorPath.length > 0 ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => refetch()}
            aria-label="Git 상태 새로고침"
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5",
                statusLoading && "animate-spin",
              )}
            />
          </Button>
        ) : null}
      </div>

      {/* Git 정보 요약 */}
      {gitMonitorPath.length > 0 && gitInfo?.is_git_repo ? (
        <div className="px-3 py-2 border-b border-border shrink-0">
          <GitInfoCard gitInfo={gitInfo} />
        </div>
      ) : null}

      {/* 변경 파일 목록 */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full" viewportClassName="h-full">
          {gitMonitorPath.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <GitBranch className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <div className="font-mono text-xs text-muted-foreground">
                모니터링할 Git 저장소를 선택하세요
              </div>
            </div>
          ) : statusLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : status ? (
            <GitStatusFileList
              repoPath={gitMonitorPath}
              files={status.files}
            />
          ) : null}
        </ScrollArea>
      </div>
    </div>
  );
}
