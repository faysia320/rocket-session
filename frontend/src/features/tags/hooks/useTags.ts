/**
 * 태그 CRUD + 세션-태그 연결 TanStack Query 훅.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { tagsApi } from "@/lib/api/tags.api";
import { tagKeys } from "./tagKeys";
import { sessionKeys } from "@/features/session/hooks/sessionKeys";
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTagRequest }) =>
      tagsApi.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: tagKeys.list() });
      const previous = queryClient.getQueryData<TagInfo[]>(tagKeys.list());
      queryClient.setQueryData<TagInfo[]>(tagKeys.list(), (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...data } : t)) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tagKeys.list(), context.previous);
      }
      toast.error("태그 수정에 실패했습니다");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
  });
}

/** 태그 삭제 */
export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tagsApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: tagKeys.list() });
      const previous = queryClient.getQueryData<TagInfo[]>(tagKeys.list());
      queryClient.setQueryData<TagInfo[]>(
        tagKeys.list(),
        (old) => old?.filter((t) => t.id !== id) ?? [],
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tagKeys.list(), context.previous);
      }
      toast.error("태그 삭제에 실패했습니다");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all });
      // 세션 목록도 갱신 (세션에 표시되는 태그가 변경될 수 있음)
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
  });
}

/** 세션에 태그 추가 */
export function useAddTagsToSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      tagIds,
    }: {
      sessionId: string;
      tagIds: string[];
    }) => tagsApi.addToSession(sessionId, tagIds),
    onSettled: (_data, _err, { sessionId }) => {
      queryClient.invalidateQueries({
        queryKey: tagKeys.forSession(sessionId),
      });
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
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
    mutationFn: ({
      sessionId,
      tagId,
    }: {
      sessionId: string;
      tagId: string;
    }) => tagsApi.removeFromSession(sessionId, tagId),
    onSettled: (_data, _err, { sessionId }) => {
      queryClient.invalidateQueries({
        queryKey: tagKeys.forSession(sessionId),
      });
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
    onError: () => {
      toast.error("태그 제거에 실패했습니다");
    },
  });
}
