import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { workflowApi } from "@/lib/api/workflow.api";
import { sessionKeys } from "@/features/session/hooks/sessionKeys";
import type {
  AddAnnotationRequest,
  UpdateAnnotationRequest,
  UpdateArtifactRequest,
  ApprovePhaseRequest,
  RequestRevisionRequest,
  StartWorkflowRequest,
} from "@/types/workflow";

export const workflowKeys = {
  all: ["workflow"] as const,
  status: (sessionId: string) =>
    [...workflowKeys.all, "status", sessionId] as const,
  artifacts: (sessionId: string) =>
    [...workflowKeys.all, "artifacts", sessionId] as const,
  artifact: (sessionId: string, artifactId: number) =>
    [...workflowKeys.all, "artifact", sessionId, artifactId] as const,
};

export function useWorkflowStatus(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: workflowKeys.status(sessionId),
    queryFn: () => workflowApi.getStatus(sessionId),
    enabled: enabled && !!sessionId,
    staleTime: 5_000,
  });
}

export function useWorkflowArtifacts(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: workflowKeys.artifacts(sessionId),
    queryFn: () => workflowApi.listArtifacts(sessionId),
    enabled: enabled && !!sessionId,
    staleTime: 5_000,
  });
}

export function useWorkflowArtifact(
  sessionId: string,
  artifactId: number,
  enabled = true,
) {
  return useQuery({
    queryKey: workflowKeys.artifact(sessionId, artifactId),
    queryFn: () => workflowApi.getArtifact(sessionId, artifactId),
    enabled: enabled && !!sessionId && artifactId > 0,
    staleTime: 5_000,
  });
}

export function useStartWorkflow(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (req: StartWorkflowRequest = {}) =>
      workflowApi.startWorkflow(sessionId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.status(sessionId),
      });
      queryClient.invalidateQueries({
        queryKey: sessionKeys.detail(sessionId),
      });
      queryClient.invalidateQueries({ queryKey: sessionKeys.list() });
    },
    onError: () => {
      toast.error("워크플로우 시작에 실패했습니다");
    },
  });
}

export function useApprovePhase(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (req: ApprovePhaseRequest = {}) =>
      workflowApi.approvePhase(sessionId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.status(sessionId),
      });
      queryClient.invalidateQueries({
        queryKey: workflowKeys.artifacts(sessionId),
      });
      queryClient.invalidateQueries({
        queryKey: sessionKeys.detail(sessionId),
      });
      queryClient.invalidateQueries({ queryKey: sessionKeys.list() });
    },
    onError: () => {
      toast.error("단계 승인에 실패했습니다");
    },
  });
}

export function useRequestRevision(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (req: RequestRevisionRequest) =>
      workflowApi.requestRevision(sessionId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.status(sessionId),
      });
      queryClient.invalidateQueries({
        queryKey: workflowKeys.artifacts(sessionId),
      });
      queryClient.invalidateQueries({
        queryKey: sessionKeys.detail(sessionId),
      });
    },
    onError: () => {
      toast.error("수정 요청에 실패했습니다");
    },
  });
}

export function useUpdateArtifact(sessionId: string, artifactId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (req: UpdateArtifactRequest) =>
      workflowApi.updateArtifact(sessionId, artifactId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.artifact(sessionId, artifactId),
      });
      queryClient.invalidateQueries({
        queryKey: workflowKeys.artifacts(sessionId),
      });
    },
    onError: () => {
      toast.error("아티팩트 수정에 실패했습니다");
    },
  });
}

export function useAddAnnotation(sessionId: string, artifactId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (req: AddAnnotationRequest) =>
      workflowApi.addAnnotation(sessionId, artifactId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.artifact(sessionId, artifactId),
      });
    },
    onError: () => {
      toast.error("주석 추가에 실패했습니다");
    },
  });
}

export function useUpdateAnnotation(
  sessionId: string,
  artifactId: number,
  annotationId: number,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (req: UpdateAnnotationRequest) =>
      workflowApi.updateAnnotation(sessionId, artifactId, annotationId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.artifact(sessionId, artifactId),
      });
    },
    onError: () => {
      toast.error("주석 상태 변경에 실패했습니다");
    },
  });
}
