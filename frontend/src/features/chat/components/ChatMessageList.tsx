import { useMemo, useCallback, useRef, useImperativeHandle, forwardRef } from "react";
import type { RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { MessageBubble } from "./MessageBubble";
import { ChatMessageContext } from "./ChatMessageContext";
import type { ChatMessageContextValue } from "./ChatMessageContext";
import type { Message, ToolUseMsg } from "@/types";
import type { ResolvedWorkflowStep } from "@/types/workflow";
import { computeEstimateSize } from "../utils/chatComputations";
import { computePrecedingPlanContents } from "../utils/chatComputations";

/** ChatPanel이 virtualizer 메서드에 접근하기 위한 핸들 */
export interface ChatMessageListHandle {
  scrollToIndex: (index: number, opts?: { align?: "start" | "center" | "end" | "auto" }) => void;
  measure: () => void;
  getTotalSize: () => number;
}

interface ChatMessageListProps {
  messages: Message[];
  searchQuery: string;
  searchMatches: number[];
  messageGaps: Array<"tight" | "normal" | "turn-start">;
  animateFromIndex: RefObject<number | null>;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
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
  onOpenPreview?: (url: string) => void;
}

export const ChatMessageList = forwardRef<ChatMessageListHandle, ChatMessageListProps>(
  function ChatMessageList(
    {
      messages,
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
      onOpenPreview,
    },
    ref,
  ) {
    const searchMatchSet = useMemo(() => new Set(searchMatches), [searchMatches]);
    const isRunning = useMemo(
      () => status === "running" || activeTools.length > 0,
      [status, activeTools.length],
    );
    const stableSearchQuery = useMemo(() => searchQuery || undefined, [searchQuery]);

    // estimateSize / getItemKey를 안정적인 참조로 유지하여 virtualizer 내부 memo 무효화 방지
    const messagesRef = useRef(messages);
    messagesRef.current = messages;

    const estimateSize = useCallback(
      (index: number) => computeEstimateSize(messagesRef.current[index]),
      [],
    );
    const getItemKey = useCallback(
      (index: number) => messagesRef.current[index]?.id ?? index,
      [],
    );

    const virtualizer = useVirtualizer({
      count: messages.length,
      getScrollElement: () => scrollContainerRef.current,
      estimateSize,
      overscan: 10,
      getItemKey,
    });

    // ChatPanel에 virtualizer 메서드 노출
    useImperativeHandle(
      ref,
      () => ({
        scrollToIndex: (index, opts) => virtualizer.scrollToIndex(index, opts),
        measure: () => virtualizer.measure(),
        getTotalSize: () => virtualizer.getTotalSize(),
      }),
      [virtualizer],
    );

    // ask_user_question 메시지에 직전 Write(Plan) 내용 매핑
    const precedingPlanContents = useMemo(
      () => computePrecedingPlanContents(messages),
      [messages],
    );

    // Context value
    const contextValue = useMemo<ChatMessageContextValue>(
      () => ({
        isRunning,
        searchQuery: stableSearchQuery,
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
        onOpenPreview,
        precedingPlanContents,
      }),
      [
        isRunning,
        stableSearchQuery,
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
        onOpenPreview,
        precedingPlanContents,
      ],
    );

    return (
      <ChatMessageContext.Provider value={contextValue}>
        <ScrollArea
          className="flex-1"
          viewportRef={scrollContainerRef}
          viewportClassName="select-text pt-3 !overflow-x-hidden"
          onScroll={onScroll}
        >
          {loading ? (
            <div className="px-4 space-y-4 animate-pulse" role="status" aria-label="메시지 로딩 중">
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
            <div
              className="h-full flex flex-col items-center justify-center gap-3 opacity-50 animate-[fadeIn_0.3s_ease]"
              role="status"
            >
              <div className="font-mono text-4xl text-primary animate-[blink_1.2s_ease-in-out_infinite]">
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
                        animate={virtualItem.index >= (animateFromIndex.current ?? Infinity)}
                      />
                    </ErrorBoundary>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </ChatMessageContext.Provider>
    );
  },
);
