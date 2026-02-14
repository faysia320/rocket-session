/**
 * 세션 도메인 API 함수.
 */
import { api } from './client';
import type { SessionInfo, UpdateSessionRequest } from '@/types';

export const sessionsApi = {
  create: (workDir?: string, options?: { allowed_tools?: string; system_prompt?: string; timeout_seconds?: number }) =>
    api.post<SessionInfo>('/api/sessions/', {
      work_dir: workDir || null,
      ...options,
    }),

  list: () => api.get<SessionInfo[]>('/api/sessions/'),

  get: (id: string) => api.get<SessionInfo>(`/api/sessions/${id}`),

  update: (id: string, data: UpdateSessionRequest) =>
    api.patch<SessionInfo>(`/api/sessions/${id}`, data),

  delete: (id: string) => api.delete<void>(`/api/sessions/${id}`),

  stop: (id: string) => api.post<void>(`/api/sessions/${id}/stop`),

  history: (id: string) => api.get<unknown[]>(`/api/sessions/${id}/history`),

  files: (id: string) => api.get<unknown[]>(`/api/sessions/${id}/files`),

  fileContent: (sessionId: string, filePath: string) =>
    api.getText(`/api/sessions/${sessionId}/file-content/${encodeURIComponent(filePath)}`),

  fileDiff: (sessionId: string, filePath: string) =>
    api.getText(`/api/sessions/${sessionId}/file-diff/${encodeURIComponent(filePath)}`),

  exportMarkdown: async (sessionId: string): Promise<void> => {
    const response = await fetch(`/api/sessions/${sessionId}/export`);
    if (!response.ok) {
      throw new Error(`Export failed: HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
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

  uploadImage: async (sessionId: string, file: File): Promise<{ path: string; name: string; size: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`/api/sessions/${sessionId}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  stats: (id: string) =>
    api.get<{
      total_messages: number;
      total_cost: number;
      total_duration_ms: number;
      total_input_tokens: number;
      total_output_tokens: number;
      total_cache_creation_tokens: number;
      total_cache_read_tokens: number;
    }>(`/api/sessions/${id}/stats`),

  openTerminal: (id: string) =>
    api.post<{ status: string; work_dir: string }>(`/api/sessions/${id}/open-terminal`),
};
