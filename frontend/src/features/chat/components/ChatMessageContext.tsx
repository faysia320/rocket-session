/**
 * ChatMessageContext — MessageBubble에 전달되는 전역 상태(콜백, 런타임 상태)를
 * Context로 분리하여 memo() 효과를 극대화한다.
 *
 * message, animate 등 메시지 고유 props만 MessageBubble에 직접 전달하고,
 * 모든 메시지에 동일한 값(isRunning, searchQuery, callbacks 등)은 Context로 제공.
 */
import { createContext, useContext } from "react";
import type { ResolvedWorkflowStep } from "@/types/workflow";

export interface ChatMessageContextValue {
  isRunning: boolean;
  searchQuery: string | undefined;
  onResend: (content: string) => void;
  onRetryError: (errorMsgId: string) => void;
  onApprovePhase: (feedback?: string) => void;
  onRequestRevision: (feedback?: string, validationSummary?: string, targetPhase?: string) => void;
  onOpenArtifact: (phase: string) => void;
  isApprovingPhase: boolean;
  isRequestingRevision: boolean;
  onAnswerQuestion: (toolUseId: string, questionIndex: number, selectedLabels: string[]) => void;
  onConfirmAnswers: (toolUseId: string) => void;
  workflowSteps: ResolvedWorkflowStep[] | undefined;
  onOpenPreview: ((url: string) => void) | undefined;
  /** ask_user_question 메시지 ID → 직전 Write(Plan 파일) content 매핑 */
  precedingPlanContents: Map<string, string>;
}

export const ChatMessageContext = createContext<ChatMessageContextValue | null>(null);

export function useChatMessageContext(): ChatMessageContextValue {
  const ctx = useContext(ChatMessageContext);
  if (!ctx) {
    throw new Error("useChatMessageContext must be used within ChatMessageContext.Provider");
  }
  return ctx;
}
