/**
 * MCP 서버 관리 TanStack Query 훅.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { mcpApi } from "@/lib/api/mcp.api";
import type {
  CreateMcpServerRequest,
  UpdateMcpServerRequest,
} from "@/types";

export const mcpKeys = {
  all: ["mcp"] as const,
  list: () => [...mcpKeys.all, "list"] as const,
  detail: (id: string) => [...mcpKeys.all, "detail", id] as const,
  system: () => [...mcpKeys.all, "system"] as const,
};

export function useMcpServers() {
  return useQuery({
    queryKey: mcpKeys.list(),
    queryFn: () => mcpApi.list(),
  });
}

export function useMcpServer(id: string) {
  return useQuery({
    queryKey: mcpKeys.detail(id),
    queryFn: () => mcpApi.get(id),
    enabled: !!id,
  });
}

export function useCreateMcpServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMcpServerRequest) => mcpApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpKeys.list() });
    },
    onError: (err) => {
      toast.error(`MCP 서버 추가에 실패했습니다: ${err instanceof Error ? err.message : String(err)}`);
    },
  });
}

export function useUpdateMcpServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateMcpServerRequest;
    }) => mcpApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpKeys.list() });
    },
    onError: (err) => {
      toast.error(`MCP 서버 업데이트에 실패했습니다: ${err instanceof Error ? err.message : String(err)}`);
    },
  });
}

export function useDeleteMcpServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mcpApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpKeys.list() });
    },
    onError: (err) => {
      toast.error(`MCP 서버 삭제에 실패했습니다: ${err instanceof Error ? err.message : String(err)}`);
    },
  });
}

export function useSystemMcpServers() {
  return useQuery({
    queryKey: mcpKeys.system(),
    queryFn: () => mcpApi.systemServers(),
    enabled: false,
  });
}

export function useImportSystemMcpServers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (names?: string[]) => mcpApi.importSystem(names),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpKeys.list() });
      queryClient.invalidateQueries({ queryKey: mcpKeys.system() });
    },
    onError: (err) => {
      toast.error(`시스템 MCP 서버 가져오기에 실패했습니다: ${err instanceof Error ? err.message : String(err)}`);
    },
  });
}
