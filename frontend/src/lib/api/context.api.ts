/**
 * 컨텍스트 자동 빌딩 API 클라이언트.
 */
import { api } from "./client";

export interface FileSuggestion {
  file_path: string;
  reason: string;
  score: number;
}

export interface SessionSummary {
  id: string;
  name: string | null;
  status: string;
  created_at: string | null;
  prompt_preview: string;
  file_count: number;
}

export interface SessionContextSuggestion {
  insights: import("@/types/knowledge").WorkspaceInsightInfo[];
  recent_sessions: SessionSummary[];
  suggested_files: FileSuggestion[];
  context_text: string;
}

export const contextApi = {
  suggest: (workspaceId: string, prompt?: string) => {
    const qs = prompt ? `?prompt=${encodeURIComponent(prompt)}` : "";
    return api.get<SessionContextSuggestion>(`/api/workspaces/${workspaceId}/context/suggest${qs}`);
  },

  recentSessions: (workspaceId: string, limit?: number) => {
    const qs = limit ? `?limit=${limit}` : "";
    return api.get<SessionSummary[]>(`/api/workspaces/${workspaceId}/context/recent-sessions${qs}`);
  },

  suggestFiles: (workspaceId: string, prompt?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (prompt) params.set("prompt", prompt);
    if (limit) params.set("limit", String(limit));
    const qs = params.toString();
    return api.get<FileSuggestion[]>(
      `/api/workspaces/${workspaceId}/context/suggest-files${qs ? `?${qs}` : ""}`,
    );
  },
};
