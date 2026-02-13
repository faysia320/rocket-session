/**
 * 로컬 Claude Code 세션 스캔 및 Import API 함수.
 */
import { api } from './client';
import type { LocalSessionMeta, ImportLocalSessionRequest, ImportLocalSessionResponse } from '@/types';

export const localSessionsApi = {
  scan: (projectDir?: string) => {
    const params = projectDir ? `?project_dir=${encodeURIComponent(projectDir)}` : '';
    return api.get<LocalSessionMeta[]>(`/api/local-sessions/${params}`);
  },

  import: (req: ImportLocalSessionRequest) =>
    api.post<ImportLocalSessionResponse>('/api/local-sessions/import', req),
};
