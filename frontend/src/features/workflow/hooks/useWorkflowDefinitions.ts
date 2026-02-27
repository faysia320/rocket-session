import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { workflowDefinitionApi } from "@/lib/api/workflowDefinition.api";
import type {
  CreateWorkflowDefinitionRequest,
  UpdateWorkflowDefinitionRequest,
  WorkflowDefinitionExport,
} from "@/types/workflow";

export const workflowDefinitionKeys = {
  all: ["workflow-definitions"] as const,
  detail: (id: string) => [...workflowDefinitionKeys.all, id] as const,
};

export function useWorkflowDefinitions() {
  return useQuery({
    queryKey: workflowDefinitionKeys.all,
    queryFn: () => workflowDefinitionApi.list(),
    staleTime: 30_000,
  });
}

export function useWorkflowDefinition(id: string, enabled = true) {
  return useQuery({
    queryKey: workflowDefinitionKeys.detail(id),
    queryFn: () => workflowDefinitionApi.get(id),
    enabled: enabled && !!id,
    staleTime: 30_000,
  });
}

export function useCreateWorkflowDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (req: CreateWorkflowDefinitionRequest) => workflowDefinitionApi.create(req),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workflowDefinitionKeys.all,
      });
      toast.success("워크플로우 정의가 생성되었습니다");
    },
    onError: () => {
      toast.error("워크플로우 정의 생성에 실패했습니다");
    },
  });
}

export function useUpdateWorkflowDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...req }: UpdateWorkflowDefinitionRequest & { id: string }) =>
      workflowDefinitionApi.update(id, req),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workflowDefinitionKeys.all,
      });
      toast.success("워크플로우 정의가 수정되었습니다");
    },
    onError: () => {
      toast.error("워크플로우 정의 수정에 실패했습니다");
    },
  });
}

export function useDeleteWorkflowDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workflowDefinitionApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workflowDefinitionKeys.all,
      });
      toast.success("워크플로우 정의가 삭제되었습니다");
    },
    onError: () => {
      toast.error("워크플로우 정의 삭제에 실패했습니다");
    },
  });
}

export function useSetDefaultWorkflowDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workflowDefinitionApi.setDefault(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workflowDefinitionKeys.all,
      });
      toast.success("기본 워크플로우가 설정되었습니다");
    },
    onError: () => {
      toast.error("기본 워크플로우 설정에 실패했습니다");
    },
  });
}

export function useImportWorkflowDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: WorkflowDefinitionExport) => workflowDefinitionApi.import(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workflowDefinitionKeys.all,
      });
      toast.success("워크플로우 정의를 가져왔습니다");
    },
    onError: () => {
      toast.error("워크플로우 정의 가져오기에 실패했습니다");
    },
  });
}
