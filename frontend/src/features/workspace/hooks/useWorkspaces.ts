import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workspacesApi } from "@/lib/api/workspaces.api";
import type {
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  WorkspaceSyncRequest,
} from "@/types/workspace";

export const workspaceKeys = {
  all: ["workspaces"] as const,
  list: () => [...workspaceKeys.all, "list"] as const,
  detail: (id: string) => [...workspaceKeys.all, "detail", id] as const,
};

export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: () => workspacesApi.list(),
    refetchInterval: 5000,
  });
}

export function useWorkspace(id: string | null) {
  return useQuery({
    queryKey: workspaceKeys.detail(id ?? ""),
    queryFn: () => workspacesApi.get(id!),
    enabled: !!id,
    refetchInterval: 3000,
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWorkspaceRequest) => workspacesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWorkspaceRequest }) =>
      workspacesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workspacesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}

export function useSyncWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: WorkspaceSyncRequest }) =>
      workspacesApi.sync(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
      queryClient.invalidateQueries({ queryKey: ["git-info"] });
      queryClient.invalidateQueries({ queryKey: ["git-status"] });
      queryClient.invalidateQueries({ queryKey: ["git-log"] });
    },
  });
}
