import { memo, useState } from "react";
import { RotateCcw, Plus, Archive, Trash2, CheckCircle2, GitCommitHorizontal } from "lucide-react";
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

interface WorkflowCompletedActionsProps {
  onContinue: () => void;
  onNewTopic: () => void;
  onCommit?: () => void;
  onArchive: () => void;
  onDelete: () => void;
  isRunning?: boolean;
  showCommit?: boolean;
}

export const WorkflowCompletedActions = memo(function WorkflowCompletedActions({
  onContinue,
  onNewTopic,
  onCommit,
  onArchive,
  onDelete,
  isRunning = false,
  showCommit = false,
}: WorkflowCompletedActionsProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-2.5 animate-[fadeIn_0.15s_ease]">
        <span className="flex items-center gap-1 text-xs font-medium text-success whitespace-nowrap shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" />
          사이클 완료
        </span>
        <div className="h-4 w-px bg-border shrink-0" />
        <button
          type="button"
          onClick={onContinue}
          disabled={isRunning}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3 h-3" />
          이어서 구현
        </button>
        <button
          type="button"
          onClick={onNewTopic}
          disabled={isRunning}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
        >
          <Plus className="w-3 h-3" />
          새 주제
        </button>
        {showCommit ? (
          <button
            type="button"
            onClick={onCommit}
            disabled={isRunning}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            <GitCommitHorizontal className="w-3 h-3" />
            커밋
          </button>
        ) : null}
        <div className="h-4 w-px bg-border shrink-0" />
        <button
          type="button"
          onClick={onArchive}
          disabled={isRunning}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
        >
          <Archive className="w-3 h-3" />
          보관
        </button>
        <button
          type="button"
          onClick={() => setDeleteConfirmOpen(true)}
          disabled={isRunning}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
        >
          <Trash2 className="w-3 h-3" />
          삭제
        </button>
      </div>
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
    </>
  );
});
