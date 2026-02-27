/**
 * 메모 블록 CRUD TanStack Query 훅.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { memoApi } from "@/lib/api/memo.api";
import { memoKeys } from "./memoKeys";
import type { CreateMemoBlockRequest, UpdateMemoBlockRequest } from "@/types";

/** 전체 블록 목록 조회 */
export function useMemoBlocks() {
  return useQuery({
    queryKey: memoKeys.blocks(),
    queryFn: () => memoApi.listBlocks(),
    staleTime: Infinity,
  });
}

/** 블록 생성 */
export function useCreateMemoBlock() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMemoBlockRequest) => memoApi.createBlock(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: memoKeys.all });
    },
    onError: () => {
      toast.error("블록 생성에 실패했습니다");
    },
  });
}

/** 블록 내용 업데이트 (debounced auto-save에서 호출) */
export function useUpdateMemoBlock() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMemoBlockRequest }) =>
      memoApi.updateBlock(id, data),
    onError: () => {
      toast.error("메모 저장에 실패했습니다");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: memoKeys.all });
    },
  });
}

/** 블록 삭제 */
export function useDeleteMemoBlock() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => memoApi.deleteBlock(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: memoKeys.all });
    },
    onError: () => {
      toast.error("블록 삭제에 실패했습니다");
    },
  });
}

/** 블록 순서 변경 */
export function useReorderMemoBlocks() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (blockIds: string[]) =>
      memoApi.reorderBlocks({ block_ids: blockIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: memoKeys.all });
    },
    onError: () => {
      toast.error("블록 순서 변경에 실패했습니다");
    },
  });
}
