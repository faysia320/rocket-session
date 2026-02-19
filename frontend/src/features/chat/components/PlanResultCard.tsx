import { useState, memo } from "react";
import { Play, Pencil, X, Send, CheckCircle2, Zap } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { cn } from "@/lib/utils";
import type { ResultMsg } from "@/types";

interface PlanResultCardProps {
  message: ResultMsg;
  isRunning: boolean;
  onExecute: (messageId: string) => void;
  onContinue: (messageId: string) => void;
  onDismiss: (messageId: string) => void;
  onRevise: (messageId: string, feedback: string) => void;
}

/** 모델명을 짧은 표시명으로 변환 */
function formatModelName(model: string): string {
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model.split("-").slice(0, 2).join(" ");
}

/** 토큰 수를 읽기 쉬운 형태로 포맷 */
function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export const PlanResultCard = memo(function PlanResultCard({
  message,
  isRunning,
  onExecute,
  onContinue,
  onDismiss,
  onRevise,
}: PlanResultCardProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const executed = !!message.planExecuted;

  const handleExecute = () => {
    onExecute(message.id);
    setShowFeedback(false);
    setFeedback("");
  };

  const handleContinue = () => {
    onContinue(message.id);
    setShowFeedback(false);
    setFeedback("");
  };

  const handleDismiss = () => {
    onDismiss(message.id);
    setShowFeedback(false);
    setFeedback("");
  };

  const handleRevise = () => {
    if (!feedback.trim()) return;
    onRevise(message.id, feedback.trim());
    setShowFeedback(false);
    setFeedback("");
  };

  const hasMetadata =
    message.duration_ms || message.model || message.input_tokens;

  return (
    <div className="animate-[slideInLeft_0.2s_ease]">
      <div
        className={cn(
          "px-3 py-2.5 bg-secondary border border-border rounded-sm border-l-[3px]",
          executed ? "border-l-success" : "border-l-primary",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-primary text-xs">{"◆"}</span>
          <span className="font-mono text-xs font-semibold text-foreground">
            Claude
          </span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded-md text-[9px] font-bold border",
              executed
                ? "bg-success/15 text-success border-success/30"
                : "bg-primary/15 text-primary border-primary/30",
            )}
          >
            Plan
          </span>
          {executed ? (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-success/15 text-success border border-success/30">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Executed
            </span>
          ) : null}
          {/* Metadata badges */}
          {hasMetadata ? (
            <div className="flex items-center gap-1.5 ml-auto">
              {message.model ? (
                <span className="font-mono text-2xs px-1.5 py-0.5 rounded-md bg-info/10 text-info border border-info/20">
                  {formatModelName(message.model)}
                </span>
              ) : null}
              {message.duration_ms ? (
                <span className="font-mono text-2xs text-muted-foreground bg-card px-1.5 py-0.5 rounded-md">
                  {(message.duration_ms / 1000).toFixed(1)}s
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Markdown Content: Plan 파일 content 우선, 없으면 result text */}
        <div className="max-h-[500px] overflow-auto rounded-md bg-input/30 p-4">
          {message.planFileContent ? (
            <>
              <MarkdownRenderer content={message.planFileContent} />
              {message.text ? (
                <div className="mt-3 pt-2 border-t border-border/20">
                  <p className="font-mono text-2xs text-muted-foreground italic">
                    {message.text}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <MarkdownRenderer content={message.text || ""} />
          )}
        </div>

        {/* Token info */}
        {message.input_tokens || message.output_tokens ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.input_tokens ? (
              <span className="font-mono text-2xs px-1.5 py-0.5 rounded-md bg-success/10 text-success border border-success/20">
                in:{formatTokens(message.input_tokens)}
                {message.cache_read_tokens
                  ? ` (cache:${formatTokens(message.cache_read_tokens)})`
                  : ""}
              </span>
            ) : null}
            {message.output_tokens ? (
              <span className="font-mono text-2xs px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                out:{formatTokens(message.output_tokens)}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Feedback Area */}
        {!executed && showFeedback ? (
          <div className="mt-3 pt-2 border-t border-border/30">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="계획 수정 피드백을 입력하세요…"
              className="w-full font-mono text-sm bg-input border border-border rounded-md px-3 py-2 outline-none focus:border-primary/50 resize-none min-h-[80px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleRevise();
                }
              }}
            />
            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                onClick={handleRevise}
                disabled={!feedback.trim() || isRunning}
                className={cn(
                  "flex items-center gap-1.5 font-mono text-xs font-semibold px-3 py-1.5 rounded transition-colors",
                  feedback.trim() && !isRunning
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                )}
                aria-label="피드백 전송"
              >
                <Send className="h-3 w-3" />
                Send Feedback
              </button>
            </div>
          </div>
        ) : null}

        {/* Action Buttons */}
        {!executed ? (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-border/30">
            <button
              type="button"
              onClick={handleContinue}
              disabled={isRunning}
              className={cn(
                "flex shrink-0 items-center gap-1.5 font-mono text-xs font-semibold px-3 py-1.5 rounded transition-colors",
                isRunning
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
              aria-label="계획 계속 작성"
            >
              <Play className="h-3 w-3" />
              Continue
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={isRunning}
              className="flex shrink-0 items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="계획 실행"
            >
              <Zap className="h-3 w-3" />
              Execute Plan
            </button>
            <button
              type="button"
              onClick={() => setShowFeedback((p) => !p)}
              disabled={isRunning}
              className="flex shrink-0 items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="계획 수정"
            >
              <Pencil className="h-3 w-3" />
              Revise
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              disabled={isRunning}
              className="flex shrink-0 items-center gap-1.5 font-mono text-xs text-muted-foreground px-3 py-1.5 rounded hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="계획 닫기"
            >
              <X className="h-3 w-3" />
              Dismiss
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
});
