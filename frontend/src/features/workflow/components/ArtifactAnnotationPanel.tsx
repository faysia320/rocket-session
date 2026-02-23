import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { MessageSquare, Lightbulb, XCircle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ArtifactAnnotationInfo } from "@/types/workflow";

const TYPE_CONFIG: Record<
  string,
  { icon: typeof MessageSquare; label: string; color: string }
> = {
  comment: { icon: MessageSquare, label: "댓글", color: "text-info" },
  suggestion: { icon: Lightbulb, label: "제안", color: "text-warning" },
  rejection: { icon: XCircle, label: "반려", color: "text-destructive" },
};

interface ArtifactAnnotationPanelProps {
  annotations: ArtifactAnnotationInfo[];
  onResolve?: (annotationId: number) => void;
  onDismiss?: (annotationId: number) => void;
  onLineClick?: (lineStart: number) => void;
}

export const ArtifactAnnotationPanel = memo(function ArtifactAnnotationPanel({
  annotations,
  onResolve,
  onDismiss,
  onLineClick,
}: ArtifactAnnotationPanelProps) {
  const grouped = annotations.reduce<
    Record<number, ArtifactAnnotationInfo[]>
  >((acc, ann) => {
    const key = ann.line_start;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ann);
    return acc;
  }, {});

  const sortedKeys = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  const handleResolve = useCallback(
    (id: number) => onResolve?.(id),
    [onResolve],
  );

  const handleDismiss = useCallback(
    (id: number) => onDismiss?.(id),
    [onDismiss],
  );

  if (annotations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground py-8">
        주석이 없습니다
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto">
      <div className="text-xs font-medium text-muted-foreground px-1">
        주석 ({annotations.length}건)
      </div>
      {sortedKeys.map((lineNum) => (
        <div key={lineNum} className="space-y-1.5">
          <button
            type="button"
            onClick={() => onLineClick?.(lineNum)}
            className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors px-1"
          >
            L{lineNum}
            {grouped[lineNum].length > 1
              ? ` (${grouped[lineNum].length}건)`
              : ""}
          </button>
          {grouped[lineNum].map((ann) => {
            const config =
              TYPE_CONFIG[ann.annotation_type] ?? TYPE_CONFIG.comment;
            const Icon = config.icon;
            const isPending = ann.status === "pending";

            return (
              <div
                key={ann.id}
                className={cn(
                  "rounded-md border p-2 text-xs",
                  isPending
                    ? "border-border bg-card"
                    : "border-border/50 bg-muted/30 opacity-60",
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={cn("w-3 h-3 shrink-0", config.color)} />
                  <span
                    className={cn("font-medium text-[10px]", config.color)}
                  >
                    {config.label}
                  </span>
                  {!isPending ? (
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {ann.status === "resolved" ? "해결됨" : "무시됨"}
                    </span>
                  ) : null}
                </div>
                <p className="text-foreground/80 whitespace-pre-wrap break-words">
                  {ann.content}
                </p>
                {isPending ? (
                  <div className="flex items-center gap-1 mt-1.5 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss(ann.id)}
                      aria-label="주석 무시"
                      className="h-5 px-1.5 text-[10px]"
                    >
                      <X className="w-2.5 h-2.5 mr-0.5" />
                      무시
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResolve(ann.id)}
                      aria-label="주석 해결"
                      className="h-5 px-1.5 text-[10px] text-success"
                    >
                      <Check className="w-2.5 h-2.5 mr-0.5" />
                      해결
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
});
