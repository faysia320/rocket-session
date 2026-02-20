import { useCallback } from "react";
import { toast } from "sonner";
import type { SessionMode } from "@/types";
import { sessionsApi } from "@/lib/api/sessions.api";

interface UsePlanActionsParams {
  sessionId: string;
  setMode: (mode: SessionMode | ((prev: SessionMode) => SessionMode)) => void;
  sendPrompt: (text: string, opts?: { mode?: SessionMode }) => void;
  updateMessage: (id: string, update: Record<string, unknown>) => void;
  updateSessionMode: (mode: SessionMode) => void;
}

export function usePlanActions({
  sessionId,
  setMode,
  sendPrompt,
  updateMessage,
  updateSessionMode,
}: UsePlanActionsParams) {
  const cycleMode = useCallback(() => {
    setMode((prev: SessionMode) => {
      const next: SessionMode = prev === "normal" ? "plan" : "normal";
      sessionsApi.update(sessionId, { mode: next }).catch(() => {
        toast.error("모드 전환에 실패했습니다");
      });
      updateSessionMode(next);
      return next;
    });
  }, [sessionId, updateSessionMode, setMode]);

  const handleExecutePlan = useCallback(
    (messageId: string) => {
      updateMessage(messageId, { planExecuted: true });
      setMode("normal");
      updateSessionMode("normal");
      sessionsApi.update(sessionId, { mode: "normal" }).catch(() => {
        toast.error("모드 전환에 실패했습니다");
      });
      sendPrompt("위의 계획대로 단계별로 실행해줘.", { mode: "normal" });
    },
    [sessionId, sendPrompt, updateMessage, updateSessionMode, setMode],
  );

  const handleContinuePlan = useCallback(
    (messageId: string) => {
      updateMessage(messageId, { planExecuted: true });
      sendPrompt("위의 계획을 승인합니다. 계속 진행해주세요.", { mode: "plan" });
    },
    [sendPrompt, updateMessage],
  );

  const handleDismissPlan = useCallback(
    (messageId: string) => {
      updateMessage(messageId, { planExecuted: true });
    },
    [updateMessage],
  );

  const handleRevise = useCallback(
    (messageId: string, feedback: string) => {
      updateMessage(messageId, { planExecuted: true });
      sendPrompt(feedback, { mode: "plan" });
    },
    [sendPrompt, updateMessage],
  );

  return {
    cycleMode,
    handleExecutePlan,
    handleContinuePlan,
    handleDismissPlan,
    handleRevise,
  };
}
