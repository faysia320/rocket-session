import { memo, useCallback, useState } from "react";
import {
  GitCommitHorizontal,
  GitPullRequest,
  GitMerge,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { GitInfo } from "@/types";

interface GitActionsBarProps {
  gitInfo: GitInfo | null;
  status: "idle" | "running" | "error";
  connected: boolean;
  onSendPrompt: (prompt: string) => void;
  onRemoveWorktree?: () => void;
}

export const GitActionsBar = memo(function GitActionsBar({
  gitInfo,
  status,
  connected,
  onSendPrompt,
  onRemoveWorktree,
}: GitActionsBarProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const hasChanges = gitInfo?.is_dirty || gitInfo?.has_untracked || false;

  const handleCommit = useCallback(() => {
    onSendPrompt("/git-commit --no-history");
  }, [onSendPrompt]);

  const handlePR = useCallback(() => {
    if (hasChanges) {
      onSendPrompt(
        "변경사항을 커밋하고 푸시한 후 GitHub PR을 생성해줘. gh pr create를 사용하고 PR 제목과 본문은 변경사항을 분석해서 작성해줘.",
      );
    } else {
      onSendPrompt(
        "GitHub PR을 생성해줘. gh pr create를 사용하고 커밋 히스토리를 분석해서 PR 제목과 본문을 작성해줘.",
      );
    }
  }, [hasChanges, onSendPrompt]);

  const handleRebase = useCallback(() => {
    onSendPrompt("/git-merge-rebase");
  }, [onSendPrompt]);

  if (!gitInfo?.is_git_repo) return null;

  const hasCommits = gitInfo.ahead > 0;
  const showCommit = hasChanges;
  const showPR = hasChanges || hasCommits;
  const showRebase = gitInfo.is_worktree && (hasChanges || hasCommits);
  const disabled = status === "running" || !connected;

  if (!showCommit && !showPR && !showRebase && !gitInfo.is_worktree)
    return null;

  return (
    <>
      <div className="absolute right-4 -top-9 z-10 flex items-center gap-1 px-1.5 py-1 rounded-lg bg-card/90 backdrop-blur border border-border shadow-md">
        {showCommit ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-success/70 hover:text-success hover:bg-success/10"
                disabled={disabled}
                onClick={handleCommit}
                aria-label="Git Commit"
              >
                <GitCommitHorizontal className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Commit</TooltipContent>
          </Tooltip>
        ) : null}
        {showPR ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-info/70 hover:text-info hover:bg-info/10"
                disabled={disabled}
                onClick={handlePR}
                aria-label="GitHub PR"
              >
                <GitPullRequest className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pull Request</TooltipContent>
          </Tooltip>
        ) : null}
        {showRebase ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-warning/70 hover:text-warning hover:bg-warning/10"
                disabled={disabled}
                onClick={handleRebase}
                aria-label="Git Rebase"
              >
                <GitMerge className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rebase & Merge</TooltipContent>
          </Tooltip>
        ) : null}
        {gitInfo.is_worktree ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                disabled={disabled}
                onClick={() => setDeleteConfirmOpen(true)}
                aria-label="워크트리 삭제"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>워크트리 삭제</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {gitInfo.is_worktree ? (
        <AlertDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-mono text-sm">
                워크트리를 삭제하시겠습니까?
              </AlertDialogTitle>
              <AlertDialogDescription className="font-mono text-xs">
                이 워크트리 디렉토리가 삭제됩니다. 미커밋 변경사항이 있으면
                강제 삭제됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-mono text-xs">
                취소
              </AlertDialogCancel>
              <AlertDialogAction
                className="font-mono text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => onRemoveWorktree?.()}
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
});
