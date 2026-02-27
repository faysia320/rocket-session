import { memo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { FileText, Check, RotateCcw, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ResultMsg } from "@/types/message";
import type { ResolvedWorkflowStep } from "@/types/workflow";

interface WorkflowPhaseCardProps {
  message: ResultMsg;
  stepConfig?: ResolvedWorkflowStep;
  onApprove?: (feedback?: string) => void;
  onRequestRevision?: (feedback?: string) => void;
  onOpenArtifact?: () => void;
  isApproving?: boolean;
  isRequestingRevision?: boolean;
  disabled?: boolean;
}

export const WorkflowPhaseCard = memo(function WorkflowPhaseCard({
  message,
  stepConfig,
  onApprove,
  onRequestRevision,
  onOpenArtifact,
  isApproving = false,
  isRequestingRevision = false,
  disabled = false,
}: WorkflowPhaseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState("");

  const label = stepConfig?.label ?? message.workflow_phase ?? "Phase";
  const Icon = FileText;
  const isApproved = message.workflowApproved === true;
  const showActions = stepConfig?.review_required ?? message.workflow_phase === "plan";

  const handleApprove = useCallback(() => {
    onApprove?.();
  }, [onApprove]);

  const handleRevisionSubmit = useCallback(() => {
    if (revisionFeedback.trim()) {
      onRequestRevision?.(revisionFeedback.trim());
      setRevisionFeedback("");
      setShowRevisionInput(false);
    }
  }, [revisionFeedback, onRequestRevision]);

  const previewText = message.text
    ? message.text.length > 300
      ? message.text.slice(0, 300) + "…"
      : message.text
    : "";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card overflow-hidden",
        isApproved ? "border-success/30" : "border-border",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/80">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">{label} 완료</span>
          {isApproved ? (
            <Badge variant="outline" className="text-success border-success/30">
              <Check className="w-3 h-3 mr-1" />
              승인됨
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {onOpenArtifact ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenArtifact}
              aria-label="아티팩트 열기"
              className="h-7 px-2 text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              아티팩트 열기
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "접기" : "펼치기"}
            className="h-7 w-7 p-0"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Content preview or full */}
      <div className="px-4 py-3">
        {expanded ? (
          <ScrollArea className="max-h-[400px]">
            <div className="prose prose-sm prose-invert max-w-none">
              <MarkdownRenderer content={message.text ?? ""} />
            </div>
          </ScrollArea>
        ) : previewText ? (
          <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
            {previewText}
          </p>
        ) : null}
      </div>

      {/* Actions: review_required인 step만 승인/수정 버튼 표시 */}
      {!isApproved && showActions ? (
        <div className="px-4 py-2.5 border-t border-border bg-muted/20">
          {showRevisionInput ? (
            <div className="space-y-2">
              <Textarea
                placeholder="수정이 필요한 내용을 설명해주세요…"
                value={revisionFeedback}
                onChange={(e) => setRevisionFeedback(e.target.value)}
                className="min-h-[60px] text-sm"
              />
              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRevisionInput(false)}
                  className="h-7 text-xs"
                >
                  취소
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleRevisionSubmit}
                  disabled={!revisionFeedback.trim() || isRequestingRevision}
                  className="h-7 text-xs"
                >
                  {isRequestingRevision ? "요청 중…" : "수정 요청"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRevisionInput(true)}
                disabled={disabled}
                className="h-7 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                수정 요청
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleApprove}
                disabled={disabled || isApproving}
                className="h-7 text-xs"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                {isApproving ? "승인 중…" : "승인 → 다음 단계"}
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
});
