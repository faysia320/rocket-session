import { memo, useState, useCallback } from "react";
import { Check, RotateCcw, Pencil, GitCommit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { parseQaChecklist } from "../utils/parseQaChecklist";

interface PhaseApprovalBarProps {
  phase?: string;
  onApprove?: (feedback?: string) => void;
  onRequestRevision?: (feedback?: string) => void;
  onToggleEdit?: () => void;
  isApproving?: boolean;
  isRequestingRevision?: boolean;
  isEditing?: boolean;
  disabled?: boolean;
  pendingAnnotationCount?: number;
  isLastPhase?: boolean;
  artifactContent?: string;
}

export const PhaseApprovalBar = memo(function PhaseApprovalBar({
  phase,
  onApprove,
  onRequestRevision,
  onToggleEdit,
  isApproving = false,
  isRequestingRevision = false,
  isEditing = false,
  disabled = false,
  pendingAnnotationCount = 0,
  isLastPhase = false,
  artifactContent,
}: PhaseApprovalBarProps) {
  "use memo";
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [qaWarningOpen, setQaWarningOpen] = useState(false);
  const [qaFailCount, setQaFailCount] = useState(0);

  const hasPendingAnnotations = pendingAnnotationCount > 0;

  const handleApprove = useCallback(() => {
    onApprove?.();
  }, [onApprove]);

  const handleRevisionSubmit = useCallback(() => {
    if (feedback.trim() || hasPendingAnnotations) {
      onRequestRevision?.(feedback.trim() || undefined);
      setFeedback("");
      setShowRevisionInput(false);
    }
  }, [feedback, onRequestRevision, hasPendingAnnotations]);

  const handleCommitClick = useCallback(() => {
    if (artifactContent) {
      const result = parseQaChecklist(artifactContent);
      if (!result.all_passed) {
        setQaFailCount(result.summary.fail);
        setQaWarningOpen(true);
        return;
      }
    }
    onApprove?.();
  }, [artifactContent, onApprove]);

  const handleConfirmCommit = useCallback(() => {
    setQaWarningOpen(false);
    onApprove?.();
  }, [onApprove]);

  return (
    <>
      {showRevisionInput ? (
        <div className="border-t border-border px-4 py-3 space-y-2 bg-card">
          {hasPendingAnnotations ? (
            <p className="text-xs text-muted-foreground">
              인라인 주석 {pendingAnnotationCount}건이 자동으로 포함됩니다.
            </p>
          ) : null}
          <Textarea
            placeholder={
              hasPendingAnnotations
                ? "추가 피드백이 있으면 입력하세요… (선택사항)"
                : "수정이 필요한 내용을 설명해주세요…"
            }
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="min-h-[60px]"
            autoFocus
          />
          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowRevisionInput(false)}>
              취소
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleRevisionSubmit}
              disabled={(!feedback.trim() && !hasPendingAnnotations) || isRequestingRevision}
            >
              {isRequestingRevision ? "요청 중…" : "수정 요청"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-t border-border px-4 py-2.5 flex items-center gap-2 justify-end bg-card">
          {onToggleEdit ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleEdit}
              disabled={disabled}
              className="mr-auto"
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              {isEditing ? "뷰어 모드" : "직접 편집"}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRevisionInput(true)}
            disabled={disabled}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            수정 요청
          </Button>
          {isLastPhase ? (
            <Button
              variant="default"
              size="sm"
              onClick={handleCommitClick}
              disabled={disabled || isApproving}
            >
              <GitCommit className="w-3.5 h-3.5 mr-1.5" />
              {isApproving ? "처리 중…" : "커밋 요청"}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleApprove}
              disabled={disabled || isApproving}
            >
              <Check className="w-3.5 h-3.5 mr-1.5" />
              {isApproving ? "승인 중…" : phase === "plan" ? "승인 → 구현 시작" : "승인 → 다음 단계"}
            </Button>
          )}
        </div>
      )}
      <AlertDialog open={qaWarningOpen} onOpenChange={setQaWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>QA 실패 항목이 있습니다</AlertDialogTitle>
            <AlertDialogDescription>
              {qaFailCount}건의 실패 항목이 있습니다. 그래도 커밋을 진행하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCommit}>그래도 커밋</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
