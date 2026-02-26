import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { workflowNodeApi } from "@/lib/api/workflowNode.api";
import type {
  CreateWorkflowNodeRequest,
  UpdateWorkflowNodeRequest,
} from "@/types/workflow";

export const workflowNodeKeys = {
  all: ["workflow-nodes"] as const,
  detail: (id: string) => [...workflowNodeKeys.all, id] as const,
};

export function useWorkflowNodes() {
  return useQuery({
    queryKey: workflowNodeKeys.all,
    queryFn: () => workflowNodeApi.list(),
    staleTime: 30_000,
  });
}

export function useCreateWorkflowNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (req: CreateWorkflowNodeRequest) =>
      workflowNodeApi.create(req),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workflowNodeKeys.all,
      });
      toast.success("워크플로우 노드가 생성되었습니다");
    },
    onError: () => {
      toast.error("워크플로우 노드 생성에 실패했습니다");
    },
  });
}

export function useUpdateWorkflowNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...req
    }: UpdateWorkflowNodeRequest & { id: string }) =>
      workflowNodeApi.update(id, req),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workflowNodeKeys.all,
      });
      toast.success("워크플로우 노드가 수정되었습니다");
    },
    onError: () => {
      toast.error("워크플로우 노드 수정에 실패했습니다");
    },
  });
}

export function useDeleteWorkflowNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workflowNodeApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workflowNodeKeys.all,
      });
      toast.success("워크플로우 노드가 삭제되었습니다");
    },
    onError: () => {
      toast.error("워크플로우 노드 삭제에 실패했습니다");
    },
  });
}
