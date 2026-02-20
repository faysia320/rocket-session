/**
 * 세션 도메인 API 함수.
 */
import { api } from "./client";
import type { SessionInfo, UpdateSessionRequest, SessionStats, Message, FileChange } from "@/types";

export const sessionsApi = {
  create: (
    workDir?: string,
    options?: {
      system_prompt?: string;
      timeout_seconds?: number;
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

  stats: (id: string) => api.get<SessionStats>(`/api/sessions/${id}/stats`),

};
