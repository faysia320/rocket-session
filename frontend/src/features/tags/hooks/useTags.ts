/**
 * 태그 CRUD + 세션-태그 연결 TanStack Query 훅.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { tagsApi } from "@/lib/api/tags.api";
import { useOptimisticMutation } from "@/lib/hooks/useOptimisticMutation";
import { tagKeys } from "./tagKeys";
import { sessionKeys } from "@/features/session/hooks/sessionKeys";
import { historyKeys } from "@/features/history/hooks/useSessionSearch";
import type { TagInfo, CreateTagRequest, UpdateTagRequest } from "@/types";

/** 전체 태그 목록 조회 */
export function useTags() {
  return useQuery({
    queryKey: tagKeys.list(),
    queryFn: () => tagsApi.list(),
    staleTime: 30_000,
  });
}

/** 태그 생성 */
export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTagRequest) => tagsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
    onError: () => {
      toast.error("태그 생성에 실패했습니다");
    },
  });
}

/** 태그 수정 */
export function useUpdateTag() {
  return useOptimisticMutation<TagInfo[], { id: string; data: UpdateTagRequest }>({
    mutationFn: ({ id, data }) => tagsApi.update(id, data),
    queryKey: tagKeys.list(),
    updater: (old, { id, data }) => old?.map((t) => (t.id === id ? { ...t, ...data } : t)) ?? [],
    errorMessage: "태그 수정에 실패했습니다",
    invalidateKey: tagKeys.all,
  });
}

/** 태그 삭제 */
export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useOptimisticMutation<TagInfo[], string>({
    mutationFn: (id) => tagsApi.delete(id),
    queryKey: tagKeys.list(),
    updater: (old, id) => old?.filter((t) => t.id !== id) ?? [],
    errorMessage: "태그 삭제에 실패했습니다",
    invalidateKey: tagKeys.all,
    // 세션 목록도 갱신 (세션에 표시되는 태그가 변경될 수 있음)
    onSettledExtra: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      queryClient.invalidateQueries({ queryKey: historyKeys.all });
    },
  });
}

/** 세션에 태그 추가 */
export function useAddTagsToSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, tagIds }: { sessionId: string; tagIds: string[] }) =>
      tagsApi.addToSession(sessionId, tagIds),
    onSettled: (_data, _err, { sessionId }) => {
      queryClient.invalidateQueries({
        queryKey: tagKeys.forSession(sessionId),
      });
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      queryClient.invalidateQueries({ queryKey: historyKeys.all });
    },
    onError: () => {
      toast.error("태그 추가에 실패했습니다");
    },
  });
}

/** 세션에서 태그 제거 */
export function useRemoveTagFromSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, tagId }: { sessionId: string; tagId: string }) =>
      tagsApi.removeFromSession(sessionId, tagId),
    onSettled: (_data, _err, { sessionId }) => {
      queryClient.invalidateQueries({
        queryKey: tagKeys.forSession(sessionId),
      });
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      queryClient.invalidateQueries({ queryKey: historyKeys.all });
    },
    onError: () => {
      toast.error("태그 제거에 실패했습니다");
    },
  });
}
