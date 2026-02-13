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
    api.getText(`/api/sessions/${sessionId}/file-content/${filePath}`),
};
