/**
 * 파일시스템 탐색 API 함수.
 */
import { api } from './client';
import type {
  DirectoryListResponse,
  GitInfo,
  WorktreeListResponse,
  WorktreeInfo,
  CreateWorktreeRequest,
} from '@/types';

export const filesystemApi = {
  listDirectory: (path: string = '~') =>
    api.get<DirectoryListResponse>(`/api/fs/list?path=${encodeURIComponent(path)}`),

  getGitInfo: (path: string) =>
    api.get<GitInfo>(`/api/fs/git-info?path=${encodeURIComponent(path)}`),

  listWorktrees: (path: string) =>
    api.get<WorktreeListResponse>(`/api/fs/worktrees?path=${encodeURIComponent(path)}`),

  createWorktree: (req: CreateWorktreeRequest) =>
    api.post<WorktreeInfo>('/api/fs/worktrees', req),
};
