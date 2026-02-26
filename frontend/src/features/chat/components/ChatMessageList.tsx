import { memo, useMemo } from "react";
import type { RefObject } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { MessageBubble } from "./MessageBubble";
import type { Message, ToolUseMsg } from "@/types";
import type { ResolvedWorkflowStep } from "@/types/workflow";

interface ChatMessageListProps {
  messages: Message[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  searchQuery: string;
  searchMatches: number[];
  messageGaps: Record<number, "tight" | "normal" | "turn-start">;
  animateFromIndex: RefObject<number>;
  scrollContainerRef: RefObject<HTMLDivElement>;
  onScroll: () => void;
  status: string;
  activeTools: ToolUseMsg[];
  loading: boolean;
  onResend: (content: string) => void;
  onRetryError: (errorMsgId: string) => void;
  onApprovePhase: () => void;
  onRequestRevision: (feedback?: string) => void;
  onOpenArtifact: (phase: string) => void;
  isApprovingPhase: boolean;
  isRequestingRevision: boolean;
  onAnswerQuestion: (toolUseId: string, questionIndex: number, selectedLabels: string[]) => void;
  onConfirmAnswers: (toolUseId: string) => void;
  workflowSteps?: ResolvedWorkflowStep[];
}

export const ChatMessageList = memo(function ChatMessageList({
  messages,
  virtualizer,
  searchQuery,
  searchMatches,
  messageGaps,
  animateFromIndex,
  scrollContainerRef,
  onScroll,
  status,
  activeTools,
  loading,
  onResend,
  onRetryError,
  onApprovePhase,
  onRequestRevision,
  onOpenArtifact,
  isApprovingPhase,
  isRequestingRevision,
  onAnswerQuestion,
  onConfirmAnswers,
  workflowSteps,
}: ChatMessageListProps) {
  const searchMatchSet = useMemo(() => new Set(searchMatches), [searchMatches]);

  return (
    <ScrollArea
      className="flex-1"
      viewportRef={scrollContainerRef}
      viewportClassName="select-text pt-3 !overflow-x-hidden"
      onScroll={onScroll}
    >
      {loading ? (
        <div className="px-4 space-y-4 animate-pulse">
          {Array.from({ length: Math.min(Math.max(3, 1), 5) }, (_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-end">
                <div className="h-10 w-48 bg-muted rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-20 bg-muted rounded" />
                <div className="h-16 w-full bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center gap-3 opacity-50 animate-[fadeIn_0.3s_ease]">
          <div className="font-mono text-[32px] text-primary animate-[blink_1.2s_ease-in-out_infinite]">
            {">"}_
          </div>
          <div className="font-mono text-md text-muted-foreground">
            Claude Code에 프롬프트를 입력하세요
          </div>
        </div>
      ) : (
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => (
            <div
              key={messages[virtualItem.index].id}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div
                className={[
                  "px-4 min-w-0 overflow-hidden",
                  messageGaps[virtualItem.index] === "tight"
                    ? "pb-0.5"
                    : messageGaps[virtualItem.index] === "turn-start"
                      ? "pb-4"
                      : "pb-2",
                  searchQuery && searchMatchSet.has(virtualItem.index)
                    ? "ring-1 ring-primary/40 rounded-sm bg-primary/5"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <ErrorBoundary>
                  <MessageBubble
                    message={messages[virtualItem.index]}
                    isRunning={status === "running" || activeTools.length > 0}
                    searchQuery={searchQuery || undefined}
                    animate={virtualItem.index >= (animateFromIndex.current ?? Infinity)}
                    onResend={onResend}
                    onRetryError={onRetryError}
                    onApprovePhase={onApprovePhase}
                    onRequestRevision={onRequestRevision}
                    onOpenArtifact={onOpenArtifact}
                    isApprovingPhase={isApprovingPhase}
                    isRequestingRevision={isRequestingRevision}
                    onAnswerQuestion={onAnswerQuestion}
                    onConfirmAnswers={onConfirmAnswers}
                    workflowSteps={workflowSteps}
                  />
                </ErrorBoundary>
              </div>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
});
