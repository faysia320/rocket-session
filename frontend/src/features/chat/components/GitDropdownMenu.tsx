import { memo, useCallback, useState } from "react";
import {
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  GitMerge,
  GitFork,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GitInfo } from "@/types";

interface GitDropdownMenuProps {
  gitInfo: GitInfo | null;
  status: "idle" | "running" | "error";
  connected: boolean;
  onSendPrompt: (prompt: string) => void;
  onRemoveWorktree?: () => void;
  onConvertToWorktree?: (branch: string) => void;
}

export const GitDropdownMenu = memo(function GitDropdownMenu({
  gitInfo,
  status,
  connected,
  onSendPrompt,
  onRemoveWorktree,
  onConvertToWorktree,
}: GitDropdownMenuProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");

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

  const handleConvert = useCallback(() => {
    if (!newBranchName.trim()) return;
    onConvertToWorktree?.(newBranchName.trim());
    setConvertDialogOpen(false);
    setNewBranchName("");
  }, [newBranchName, onConvertToWorktree]);

  if (!gitInfo?.is_git_repo) return null;

  const hasCommits = gitInfo.ahead > 0;
  const showCommit = hasChanges;
  const showPR = hasChanges || hasCommits;
  const showRebase = gitInfo.is_worktree && (hasChanges || hasCommits);
  const showConvertToWorktree = !gitInfo.is_worktree;
  const disabled = status === "running" || !connected;

  if (!showCommit && !showPR && !showRebase && !gitInfo.is_worktree && !showConvertToWorktree)
    return null;

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Git 작업"
              >
                <GitBranch className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Git 작업</TooltipContent>
        </Tooltip>
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
              className="group font-mono text-xs gap-2"
            >
              <GitMerge className="h-3.5 w-3.5 text-warning group-focus:text-accent-foreground" />
              Rebase & Merge
            </DropdownMenuItem>
          ) : null}
          {showConvertToWorktree ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setNewBranchName("");
                  setConvertDialogOpen(true);
                }}
                disabled={disabled}
                className="font-mono text-xs gap-2"
              >
                <GitFork className="h-3.5 w-3.5 text-info" />
                워크트리로 전환
              </DropdownMenuItem>
            </>
          ) : null}
          {gitInfo.is_worktree ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={disabled}
                className="font-mono text-xs gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
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
                이 워크트리 디렉토리와 연결된 브랜치가 삭제됩니다. 미커밋
                변경사항이 있으면 강제 삭제됩니다. 원격 브랜치(origin)도 함께
                삭제됩니다.
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
      {showConvertToWorktree ? (
        <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-mono text-sm">
                워크트리로 전환
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">
                현재 세션의 작업 디렉토리를 새 Git 워크트리로 전환합니다.
                대화 기록과 컨텍스트는 모두 보존됩니다.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-2">
              <Label htmlFor="convert-branch-name" className="font-mono text-xs text-muted-foreground">
                현재 브랜치: <code className="text-info/80">{gitInfo.branch ?? "unknown"}</code>
              </Label>
              <Input
                id="convert-branch-name"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="새 브랜치명 (예: feature/my-branch)"
                className="font-mono text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newBranchName.trim()) {
                    handleConvert();
                  }
                }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={() => setConvertDialogOpen(false)}
              >
                취소
              </Button>
              <Button
                size="sm"
                className="font-mono text-xs"
                onClick={handleConvert}
                disabled={!newBranchName.trim()}
              >
                전환
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
});
