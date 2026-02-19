import { memo, useCallback, useState } from "react";
import {
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  GitMerge,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface GitDropdownMenuProps {
  gitInfo: GitInfo | null;
  status: "idle" | "running" | "error";
  connected: boolean;
  onSendPrompt: (prompt: string) => void;
  onRemoveWorktree?: () => void;
}

export const GitDropdownMenu = memo(function GitDropdownMenu({
  gitInfo,
  status,
  connected,
  onSendPrompt,
  onRemoveWorktree,
}: GitDropdownMenuProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const hasChanges = gitInfo?.is_dirty || gitInfo?.has_untracked || false;

  const handleCommit = useCallback(() => {
    onSendPrompt("/git-commit");
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Git actions"
            title="Git actions"
          >
            <GitBranch className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {showCommit ? (
            <DropdownMenuItem
              onClick={handleCommit}
              disabled={disabled}
              className="font-mono text-xs gap-2"
            >
              <GitCommitHorizontal className="h-3.5 w-3.5 text-success" />
              Commit
            </DropdownMenuItem>
          ) : null}
          {showPR ? (
            <DropdownMenuItem
              onClick={handlePR}
              disabled={disabled}
              className="font-mono text-xs gap-2"
            >
              <GitPullRequest className="h-3.5 w-3.5 text-info" />
              Pull Request
            </DropdownMenuItem>
          ) : null}
          {showRebase ? (
            <DropdownMenuItem
              onClick={handleRebase}
              disabled={disabled}
              className="font-mono text-xs gap-2"
            >
              <GitMerge className="h-3.5 w-3.5 text-warning" />
              Rebase & Merge
            </DropdownMenuItem>
          ) : null}
          {gitInfo.is_worktree ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={disabled}
                className="font-mono text-xs gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                워크트리 삭제
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
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
