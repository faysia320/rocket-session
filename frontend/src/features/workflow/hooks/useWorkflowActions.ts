import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApprovePhase, useRequestRevision, workflowKeys } from "./useWorkflow";
import { sessionKeys } from "@/features/session/hooks/sessionKeys";

const PHASE_NAMES: Record<string, string> = {
  research: "연구",
  plan: "계획",
  implement: "구현",
};

interface UseWorkflowActionsParams {
  sessionId: string;
  sendPrompt?: (prompt: string) => void;
}

export function useWorkflowActions({
  sessionId,
  sendPrompt,
}: UseWorkflowActionsParams) {
  const queryClient = useQueryClient();
  const approveMutation = useApprovePhase(sessionId);
  const revisionMutation = useRequestRevision(sessionId);
  const [artifactViewerOpen, setArtifactViewerOpen] = useState(false);
  const [viewingArtifactId, setViewingArtifactId] = useState<number | null>(null);

  const handleAdvancePhase = useCallback(
    async (feedback?: string) => {
      try {
        const result = await approveMutation.mutateAsync({ feedback });
        const nextPhase = (result as Record<string, unknown>).next_phase as string | null;

        if (nextPhase === "implement") {
          toast.success("구현을 시작합니다");
        } else if (nextPhase) {
          toast.success(
            `${PHASE_NAMES[nextPhase] ?? nextPhase} 단계로 전환되었습니다`,
          );
        } else {
          toast.success("워크플로우가 완료되었습니다");
        }

        queryClient.invalidateQueries({
          queryKey: workflowKeys.status(sessionId),
        });
        queryClient.invalidateQueries({
          queryKey: sessionKeys.detail(sessionId),
        });
      } catch {
        // 에러 토스트는 mutation onError에서 처리
      }
    },
    [approveMutation, sendPrompt, sessionId, queryClient],
  );

  const handleRequestRevision = useCallback(
    async (feedback: string) => {
      try {
        await revisionMutation.mutateAsync({ feedback });
        toast.success("수정 요청이 전송되었습니다. 계획을 다시 작성합니다…");

        queryClient.invalidateQueries({
          queryKey: workflowKeys.status(sessionId),
        });
        queryClient.invalidateQueries({
          queryKey: workflowKeys.artifacts(sessionId),
        });
      } catch {
        // 에러 토스트는 mutation onError에서 처리
      }
    },
    [revisionMutation, sessionId, queryClient],
  );

  const handleOpenArtifact = useCallback((artifactId: number) => {
    setViewingArtifactId(artifactId);
    setArtifactViewerOpen(true);
  }, []);

  const handleCloseArtifact = useCallback(() => {
    setArtifactViewerOpen(false);
    setViewingArtifactId(null);
  }, []);

  return {
    handleAdvancePhase,
    handleRequestRevision,
    handleOpenArtifact,
    handleCloseArtifact,
    artifactViewerOpen,
    viewingArtifactId,
    isApproving: approveMutation.isPending,
    isRequestingRevision: revisionMutation.isPending,
  };
}
