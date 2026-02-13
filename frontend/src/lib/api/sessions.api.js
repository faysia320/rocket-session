/**
 * 세션 도메인 API 함수.
 */
import { apiClient } from './client';

export const sessionsApi = {
  create: (workDir) =>
    apiClient('/api/sessions/', {
      method: 'POST',
      body: JSON.stringify({ work_dir: workDir || null }),
    }),

  list: () => apiClient('/api/sessions/'),

  get: (id) => apiClient(`/api/sessions/${id}`),

  delete: (id) =>
    apiClient(`/api/sessions/${id}`, { method: 'DELETE' }),

  stop: (id) =>
    apiClient(`/api/sessions/${id}/stop`, { method: 'POST' }),

  history: (id) => apiClient(`/api/sessions/${id}/history`),

  files: (id) => apiClient(`/api/sessions/${id}/files`),
};
