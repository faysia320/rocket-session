import { memo, useCallback, useState } from "react";
import {
  EllipsisVertical,
  Download,
  Settings,
  Archive,
  ArchiveRestore,
  Trash2,
  GitFork,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
import { sessionsApi } from "@/lib/api/sessions.api";
import type { GitInfo } from "@/types";

interface SessionDropdownMenuProps {
  sessionId: string;
  isArchived?: boolean;
  gitInfo?: GitInfo | null;
  onOpenSettings: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete?: () => void;
  onFork?: () => void;
  onConvertToWorktree?: (branch: string) => void;
}

export const SessionDropdownMenu = memo(function SessionDropdownMenu({
  sessionId,
  isArchived,
  gitInfo,
  onOpenSettings,
  onArchive,
  onUnarchive,
  onDelete,
  onFork,
  onConvertToWorktree,
}: SessionDropdownMenuProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const handleExport = useCallback(() => {
    sessionsApi.exportMarkdown(sessionId);
  }, [sessionId]);

  const showConvertToWorktree = gitInfo?.is_git_repo && !gitInfo?.is_worktree;

  const handleConvert = useCallback(() => {
    if (!newBranchName.trim()) return;
    onConvertToWorktree?.(newBranchName.trim());
    setConvertDialogOpen(false);
    setNewBranchName("");
  }, [newBranchName, onConvertToWorktree]);

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="세션 메뉴">
                <EllipsisVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>세션 메뉴</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={() => setDeleteConfirmOpen(true)}
            className="font-mono text-xs gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            삭제하기
          </DropdownMenuItem>
          {isArchived ? (
            <DropdownMenuItem onClick={onUnarchive} className="font-mono text-xs gap-2">
              <ArchiveRestore className="h-3.5 w-3.5" />
              보관 해제
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={onArchive} className="font-mono text-xs gap-2">
              <Archive className="h-3.5 w-3.5" />
              보관하기
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onFork} className="font-mono text-xs gap-2">
            <GitFork className="h-3.5 w-3.5" />
            세션 포크
          </DropdownMenuItem>
          {showConvertToWorktree ? (
            <DropdownMenuItem
              onClick={() => {
                setNewBranchName("");
                setConvertDialogOpen(true);
              }}
              className="font-mono text-xs gap-2"
            >
              <GitFork className="h-3.5 w-3.5 text-info" />
              워크트리로 전환
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExport} className="font-mono text-xs gap-2">
            <Download className="h-3.5 w-3.5" />
            대화 내보내기
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setTimeout(() => onOpenSettings(), 0);
            }}
            className="font-mono text-xs gap-2"
          >
            <Settings className="h-3.5 w-3.5" />
            세션 설정
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-sm">
              세션을 삭제하시겠습니까?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs">
              이 세션의 모든 대화 기록과 파일 변경 이력이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수
              없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono text-xs">취소</AlertDialogCancel>
            <AlertDialogAction
              className="font-mono text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onDelete}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {showConvertToWorktree ? (
        <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-mono text-sm">워크트리로 전환</DialogTitle>
              <DialogDescription className="font-mono text-xs">
                현재 세션의 작업 디렉토리를 새 Git 워크트리로 전환합니다. 대화 기록과 컨텍스트는
                모두 보존됩니다.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-2">
              <Label
                htmlFor="convert-branch-name"
                className="font-mono text-xs text-muted-foreground"
              >
                현재 브랜치: <code className="text-info/80">{gitInfo?.branch ?? "unknown"}</code>
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
