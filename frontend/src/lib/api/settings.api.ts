import { api } from './client';
import type { GlobalSettings, UpdateGlobalSettingsRequest } from '@/types';

/** 글로벌 설정 API */
export const settingsApi = {
  /** 글로벌 설정 조회 */
  get: () => api.get<GlobalSettings>('/api/settings/'),

  /** 글로벌 설정 업데이트 */
  update: (data: UpdateGlobalSettingsRequest) =>
    api.patch<GlobalSettings>('/api/settings/', data),
};
