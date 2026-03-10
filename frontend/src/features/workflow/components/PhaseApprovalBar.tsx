import { memo, useState, useCallback } from "react";
import { Check, RotateCcw, Pencil, ShieldAlert, ShieldCheck } from "lucide-react";
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
import type { ValidationResult } from "@/types/workflow";

interface PhaseApprovalBarProps {
  phase?: string;
  onApprove?: (feedback?: string, force?: boolean) => void;
  onRequestRevision?: (feedback?: string, validationSummary?: string, targetPhase?: string) => void;
  onToggleEdit?: () => void;
  isApproving?: boolean;
  isRequestingRevision?: boolean;
  isEditing?: boolean;
  disabled?: boolean;
  pendingAnnotationCount?: number;
  isLastPhase?: boolean;
  artifactContent?: string;
  validationResult?: ValidationResult | null;
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
  validationResult,
}: PhaseApprovalBarProps) {
  "use memo";
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [qaWarningOpen, setQaWarningOpen] = useState(false);
  const [qaFailCount, setQaFailCount] = useState(0);
  const [validationWarningOpen, setValidationWarningOpen] = useState(false);

  const hasPendingAnnotations = pendingAnnotationCount > 0;
  const hasValidationFailure = validationResult != null && !validationResult.passed;

  const handleApprove = useCallback(() => {
    onApprove?.();
  }, [onApprove]);

  const handleForceApprove = useCallback(() => {
    setValidationWarningOpen(false);
    onApprove?.(undefined, true);
  }, [onApprove]);

  const handleRevisionSubmit = useCallback(() => {
    if (feedback.trim() || hasPendingAnnotations) {
      onRequestRevision?.(
        feedback.trim() || undefined,
        undefined,
        isLastPhase ? "implement" : undefined,
      );
      setFeedback("");
      setShowRevisionInput(false);
    }
  }, [feedback, onRequestRevision, hasPendingAnnotations, isLastPhase]);

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
      {/* 검증 실패 결과 배너 */}
      {hasValidationFailure ? (
        <div className="border-t border-destructive/30 bg-destructive/5 px-4 py-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-sm font-medium text-destructive">
            <ShieldAlert className="w-4 h-4" />
            검증 실패
          </div>
          <div className="space-y-1">
            {validationResult.results.map((r) => (
              <div
                key={r.name}
                className="flex items-center gap-2 text-xs font-mono"
              >
                {r.passed ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-chart-2 shrink-0" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5 text-destructive shrink-0" />
                )}
                <span className={r.passed ? "text-muted-foreground" : "text-destructive"}>
                  {r.name}
                </span>
                <span className="text-muted-foreground">
                  (exit={r.exit_code}, {r.duration_ms}ms)
                </span>
              </div>
            ))}
          </div>
          {validationResult.results.some((r) => !r.passed && (r.stderr || r.stdout)) ? (
            <pre className="text-2xs text-muted-foreground bg-muted rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
              {validationResult.results
                .filter((r) => !r.passed)
                .map((r) => r.stderr || r.stdout)
                .join("\n---\n")
                .slice(0, 1000)}
            </pre>
          ) : null}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onRequestRevision?.(
                  undefined,
                  validationResult.summary,
                  isLastPhase ? "implement" : undefined,
                );
              }}
              disabled={isRequestingRevision}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              {isRequestingRevision ? "요청 중…" : "수정 요청 (검증 결과 포함)"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setValidationWarningOpen(true)}
              className="text-muted-foreground"
            >
              강제 승인
            </Button>
          </div>
        </div>
      ) : null}

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
      ) : !hasValidationFailure ? (
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
            {isLastPhase ? "추가 수정 요청" : "수정 요청"}
          </Button>
          {isLastPhase ? (
            <Button
              variant="default"
              size="sm"
              onClick={handleCommitClick}
              disabled={disabled || isApproving}
            >
              <Check className="w-3.5 h-3.5 mr-1.5" />
              {isApproving ? "처리 중…" : "완료"}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleApprove}
              disabled={disabled || isApproving}
            >
              <Check className="w-3.5 h-3.5 mr-1.5" />
              {isApproving ? "승인 중…" : "승인 → 다음 단계"}
            </Button>
          )}
        </div>
      ) : null}
      <AlertDialog open={qaWarningOpen} onOpenChange={setQaWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>QA 실패 항목이 있습니다</AlertDialogTitle>
            <AlertDialogDescription>
              {qaFailCount}건의 실패 항목이 있습니다. 그래도 완료하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCommit}>그래도 완료</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={validationWarningOpen} onOpenChange={setValidationWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>검증 실패를 무시하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              검증에 실패한 항목이 있습니다. 강제 승인하면 검증을 건너뛰고 다음 단계로 진행합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleForceApprove}>강제 승인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
