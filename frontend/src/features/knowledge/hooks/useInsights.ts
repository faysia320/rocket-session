import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { insightsApi } from "@/lib/api/insights.api";
import { insightKeys } from "./insightKeys";
import type {
  WorkspaceInsightInfo,
  CreateInsightRequest,
  UpdateInsightRequest,
  InsightCategory,
} from "@/types/knowledge";

export function useInsights(workspaceId: string | null, category?: InsightCategory) {
  return useQuery({
    queryKey: category
      ? insightKeys.listByCategory(workspaceId ?? "", category)
      : insightKeys.list(workspaceId ?? ""),
    queryFn: () => insightsApi.list(workspaceId!, { category }),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useCreateInsight(workspaceId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateInsightRequest) => insightsApi.create(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insightKeys.list(workspaceId) });
      toast.success("인사이트가 생성되었습니다");
    },
    onError: () => {
      toast.error("인사이트 생성에 실패했습니다");
    },
  });

  return mutation;
}

export function useUpdateInsight(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ insightId, data }: { insightId: number; data: UpdateInsightRequest }) =>
      insightsApi.update(workspaceId, insightId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insightKeys.list(workspaceId) });
    },
    onError: () => {
      toast.error("인사이트 수정에 실패했습니다");
    },
  });
}

export function useDeleteInsight(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (insightId: number) => insightsApi.delete(workspaceId, insightId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insightKeys.list(workspaceId) });
      toast.success("인사이트가 삭제되었습니다");
    },
    onError: () => {
      toast.error("인사이트 삭제에 실패했습니다");
    },
  });
}

export function useExtractInsights(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => insightsApi.extract(workspaceId, { session_id: sessionId }),
    onSuccess: (insights) => {
      queryClient.invalidateQueries({ queryKey: insightKeys.list(workspaceId) });
      toast.success(`${insights.length}건의 인사이트가 추출되었습니다`);
    },
    onError: () => {
      toast.error("인사이트 추출에 실패했습니다");
    },
  });
}

export function useArchiveInsights(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: number[]) => insightsApi.archive(workspaceId, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insightKeys.list(workspaceId) });
    },
  });
}

export function useInsightContext(workspaceId: string | null, prompt?: string) {
  return useQuery({
    queryKey: insightKeys.context(workspaceId ?? "", prompt),
    queryFn: () => insightsApi.context(workspaceId!, prompt),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}
