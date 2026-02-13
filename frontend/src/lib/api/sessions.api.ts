/**
 * 세션 도메인 API 함수.
 */
import { api } from './client';
import type { SessionInfo } from '@/types';

export const sessionsApi = {
  create: (workDir?: string) =>
    api.post<SessionInfo>('/api/sessions/', { work_dir: workDir || null }),

  list: () => api.get<SessionInfo[]>('/api/sessions/'),

  get: (id: string) => api.get<SessionInfo>(`/api/sessions/${id}`),

  delete: (id: string) => api.delete<void>(`/api/sessions/${id}`),

  stop: (id: string) => api.post<void>(`/api/sessions/${id}/stop`),

  history: (id: string) => api.get<unknown[]>(`/api/sessions/${id}/history`),

  files: (id: string) => api.get<unknown[]>(`/api/sessions/${id}/files`),
};
