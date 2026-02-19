/**
 * 파일시스템 탐색 API 함수.
 */
import { api } from "./client";
import type {
  DirectoryListResponse,
  GitInfo,
  GitStatusResponse,
  WorktreeListResponse,
  WorktreeInfo,
  CreateWorktreeRequest,
  SkillListResponse,
} from "@/types";

export const filesystemApi = {
  listDirectory: (path: string = "~") =>
    api.get<DirectoryListResponse>(
      `/api/fs/list?path=${encodeURIComponent(path)}`,
    ),

  getGitInfo: (path: string) =>
    api.get<GitInfo>(`/api/fs/git-info?path=${encodeURIComponent(path)}`),

  getGitStatus: (path: string) =>
    api.get<GitStatusResponse>(
      `/api/fs/git-status?path=${encodeURIComponent(path)}`,
    ),

  getGitDiff: (repoPath: string, filePath: string) =>
    api.getText(
      `/api/fs/git-diff?path=${encodeURIComponent(repoPath)}&file=${encodeURIComponent(filePath)}`,
    ),

  listWorktrees: (path: string) =>
    api.get<WorktreeListResponse>(
      `/api/fs/worktrees?path=${encodeURIComponent(path)}`,
    ),

  createWorktree: (req: CreateWorktreeRequest) =>
    api.post<WorktreeInfo>("/api/fs/worktrees", req),

  removeWorktree: (path: string, force = false) =>
    api.delete<{ ok: boolean }>(
      `/api/fs/worktrees?path=${encodeURIComponent(path)}&force=${force}`,
    ),

  listSkills: (path: string) =>
    api.get<SkillListResponse>(
      `/api/fs/skills?path=${encodeURIComponent(path)}`,
    ),
};
