/**
 * 메모 블록 도메인 API 함수.
 */
import { api } from "./client";
import type {
  MemoBlockInfo,
  CreateMemoBlockRequest,
  UpdateMemoBlockRequest,
  ReorderMemoBlocksRequest,
} from "@/types";

export const memoApi = {
  listBlocks: () => api.get<MemoBlockInfo[]>("/api/memo/blocks"),

  createBlock: (data: CreateMemoBlockRequest) => api.post<MemoBlockInfo>("/api/memo/blocks", data),

  updateBlock: (id: string, data: UpdateMemoBlockRequest) =>
    api.patch<MemoBlockInfo>(`/api/memo/blocks/${id}`, data),

  deleteBlock: (id: string) => api.delete<void>(`/api/memo/blocks/${id}`),

  reorderBlocks: (data: ReorderMemoBlocksRequest) =>
    api.put<MemoBlockInfo[]>("/api/memo/blocks/reorder", data),
};
