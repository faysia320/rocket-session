/**
 * 태그 도메인 API 함수.
 */
import { api } from "./client";
import type { TagInfo, CreateTagRequest, UpdateTagRequest } from "@/types";

export const tagsApi = {
  list: () => api.get<TagInfo[]>("/api/tags/"),

  create: (data: CreateTagRequest) => api.post<TagInfo>("/api/tags/", data),

  update: (id: string, data: UpdateTagRequest) =>
    api.patch<TagInfo>(`/api/tags/${id}`, data),

  delete: (id: string) => api.delete<void>(`/api/tags/${id}`),

  addToSession: (sessionId: string, tagIds: string[]) =>
    api.post<TagInfo[]>(`/api/sessions/${sessionId}/tags`, {
      tag_ids: tagIds,
    }),

  removeFromSession: (sessionId: string, tagId: string) =>
    api.delete<void>(`/api/sessions/${sessionId}/tags/${tagId}`),
};
