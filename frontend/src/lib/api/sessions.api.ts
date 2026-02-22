/**
 * 세션 도메인 API 함수.
 */
import { api } from "./client";
import type { SessionInfo, UpdateSessionRequest, SessionStats, Message, FileChange } from "@/types";

export interface SearchSessionsParams {
  q?: string;
  fts?: string;
  status?: string;
  model?: string;
  work_dir?: string;
  tag_ids?: string[];
  date_from?: string;
  date_to?: string;
  sort?: string;
  order?: string;
  limit?: number;
  offset?: number;
  include_tags?: boolean;
}

export interface PaginatedSessions {
  items: SessionInfo[];
  total: number;
  limit: number;
  offset: number;
}

export const sessionsApi = {
  create: (
    workDir?: string,
    options?: {
      system_prompt?: string;
      timeout_seconds?: number;
      template_id?: string;
      additional_dirs?: string[];
      fallback_model?: string;
    },
  ) =>
    api.post<SessionInfo>("/api/sessions/", {
      work_dir: workDir || null,
      ...options,
    }),

  list: () => api.get<SessionInfo[]>("/api/sessions/"),

  get: (id: string) => api.get<SessionInfo>(`/api/sessions/${id}`),

  update: (id: string, data: UpdateSessionRequest) =>
    api.patch<SessionInfo>(`/api/sessions/${id}`, data),

  delete: (id: string) => api.delete<void>(`/api/sessions/${id}`),

  stop: (id: string) => api.post<void>(`/api/sessions/${id}/stop`),

  archive: (id: string) => api.post<{ status: string }>(`/api/sessions/${id}/archive`),

  unarchive: (id: string) => api.post<{ status: string }>(`/api/sessions/${id}/unarchive`),

  history: (id: string) => api.get<Message[]>(`/api/sessions/${id}/history`),

  files: (id: string) => api.get<FileChange[]>(`/api/sessions/${id}/files`),

  fileContent: (sessionId: string, filePath: string) =>
    api.getText(
      `/api/sessions/${sessionId}/file-content/${encodeURIComponent(filePath)}`,
    ),

  fileDiff: (sessionId: string, filePath: string) =>
    api.getText(
      `/api/sessions/${sessionId}/file-diff/${encodeURIComponent(filePath)}`,
    ),

  exportMarkdown: async (sessionId: string): Promise<void> => {
    const blob = await api.getBlob(`/api/sessions/${sessionId}/export`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${sessionId}.md`;
    document.body.appendChild(a);
    try {
      a.click();
    } finally {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  },

  uploadImage: async (
    sessionId: string,
    file: File,
  ): Promise<{ path: string; name: string; size: number }> => {
    const formData = new FormData();
    formData.append("file", file);
    return api.postFormData(`/api/sessions/${sessionId}/upload`, formData);
  },

  fork: (sessionId: string, messageId?: number) =>
    api.post<SessionInfo>(`/api/sessions/${sessionId}/fork`, {
      message_id: messageId ?? null,
    }),

  stats: (id: string) => api.get<SessionStats>(`/api/sessions/${id}/stats`),

  search: (params: SearchSessionsParams) => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set("q", params.q);
    if (params.fts) searchParams.set("fts", params.fts);
    if (params.status) searchParams.set("status", params.status);
    if (params.model) searchParams.set("model", params.model);
    if (params.work_dir) searchParams.set("work_dir", params.work_dir);
    if (params.tag_ids?.length) searchParams.set("tag_ids", params.tag_ids.join(","));
    if (params.date_from) searchParams.set("date_from", params.date_from);
    if (params.date_to) searchParams.set("date_to", params.date_to);
    if (params.sort) searchParams.set("sort", params.sort);
    if (params.order) searchParams.set("order", params.order);
    if (params.limit != null) searchParams.set("limit", String(params.limit));
    if (params.offset != null) searchParams.set("offset", String(params.offset));
    if (params.include_tags) searchParams.set("include_tags", "true");
    return api.get<PaginatedSessions>(`/api/sessions/search?${searchParams.toString()}`);
  },
};
