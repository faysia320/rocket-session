import { useCallback, useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApprovePhase, useRequestRevision, workflowKeys } from "./useWorkflow";
import { workflowApi } from "@/lib/api/workflow.api";
import { sessionKeys } from "@/features/session/hooks/sessionKeys";

import type { ResolvedWorkflowStep } from "@/types/workflow";

interface UseWorkflowActionsParams {
  sessionId: string;
  sendPrompt?: (prompt: string) => void;
  workflowPhase?: string | null;
  workflowPhaseStatus?: string | null;
  workflowSteps?: ResolvedWorkflowStep[];
}

export function useWorkflowActions({
  sessionId,
  sendPrompt: _sendPrompt,
  workflowPhase,
  workflowPhaseStatus,
  workflowSteps,
}: UseWorkflowActionsParams) {
  const queryClient = useQueryClient();
  const approveMutation = useApprovePhase(sessionId);
  const revisionMutation = useRequestRevision(sessionId);
  const [artifactViewerOpen, setArtifactViewerOpen] = useState(false);
  const [viewingArtifactId, setViewingArtifactId] = useState<number | null>(null);

  // 새로고침 후 awaiting_approval 상태면 아티팩트 뷰어 자동 열기
  const autoOpenedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      workflowPhaseStatus === "awaiting_approval" &&
      workflowPhase &&
      !artifactViewerOpen
    ) {
      const key = `${sessionId}-${workflowPhase}-${workflowPhaseStatus}`;
      if (autoOpenedKeyRef.current === key) return;
      autoOpenedKeyRef.current = key;

      workflowApi
        .listArtifacts(sessionId)
        .then((artifacts) => {
          const latest = artifacts
            .filter((a) => a.phase === workflowPhase)
            .sort((a, b) => b.version - a.version)[0];
          if (latest) {
            setViewingArtifactId(latest.id);
            setArtifactViewerOpen(true);
          }
        })
        .catch(() => {
          // 조용히 실패 — 사용자가 수동으로 열 수 있음
        });
    }
  }, [sessionId, workflowPhase, workflowPhaseStatus, artifactViewerOpen]);

  const handleAdvancePhase = useCallback(
    async (feedback?: string) => {
      try {
        const result = await approveMutation.mutateAsync({ feedback });
        const nextPhase = (result as Record<string, unknown>).next_phase as string | null;

        if (nextPhase) {
          const nextStep = workflowSteps?.find((s) => s.name === nextPhase);
          const nextLabel = nextStep?.label ?? nextPhase;
          toast.success(`${nextLabel} 단계로 전환되었습니다`);
        } else {
          toast.success("워크플로우가 완료되었습니다");
        }

        queryClient.invalidateQueries({
          queryKey: workflowKeys.status(sessionId),
        });
        queryClient.invalidateQueries({
          queryKey: sessionKeys.detail(sessionId),
        });

        // 승인 성공 시 아티팩트 뷰어 자동 닫기
        setArtifactViewerOpen(false);
        setViewingArtifactId(null);
      } catch {
        // 에러 토스트는 mutation onError에서 처리
      }
    },
    [approveMutation, sessionId, queryClient, workflowSteps],
  );

  const handleRequestRevision = useCallback(
    async (feedback?: string) => {
      try {
        await revisionMutation.mutateAsync({ feedback: feedback || "" });
        toast.success("수정 요청이 전송되었습니다. 계획을 다시 작성합니다…");

        queryClient.invalidateQueries({
          queryKey: workflowKeys.status(sessionId),
        });
        queryClient.invalidateQueries({
          queryKey: workflowKeys.artifacts(sessionId),
        });

        // 수정 요청 성공 시 아티팩트 뷰어 자동 닫기
        setArtifactViewerOpen(false);
        setViewingArtifactId(null);
      } catch {
        // 에러 토스트는 mutation onError에서 처리
      }
    },
    [revisionMutation, sessionId, queryClient],
  );

  const handleOpenArtifact = useCallback(async (phase: string) => {
    try {
      const artifacts = await workflowApi.listArtifacts(sessionId);
      const latest = artifacts
        .filter((a) => a.phase === phase)
        .sort((a, b) => b.version - a.version)[0];
      if (latest) {
        setViewingArtifactId(latest.id);
        setArtifactViewerOpen(true);
      } else {
        toast.info("해당 단계의 아티팩트가 아직 없습니다");
      }
    } catch {
      toast.error("아티팩트를 불러오지 못했습니다");
    }
  }, [sessionId]);

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
