/**
 * 파일시스템 탐색 API 함수.
 */
import { api } from "./client";
import type {
  DirectoryListResponse,
  GitInfo,
  GitStatusResponse,
  GitLogResponse,
  GitHubCLIStatus,
  GitHubPRListResponse,
  GitHubPRDetail,
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

  getGitLog: (
    path: string,
    params?: {
      limit?: number;
      offset?: number;
      author?: string;
      since?: string;
      until?: string;
      search?: string;
    },
  ) => {
    const sp = new URLSearchParams({ path });
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.offset) sp.set("offset", String(params.offset));
    if (params?.author) sp.set("author", params.author);
    if (params?.since) sp.set("since", params.since);
    if (params?.until) sp.set("until", params.until);
    if (params?.search) sp.set("search", params.search);
    return api.get<GitLogResponse>(`/api/fs/git-log?${sp}`);
  },

  getCommitDiff: (path: string, commitHash: string) =>
    api.getText(
      `/api/fs/git-commit-diff?path=${encodeURIComponent(path)}&commit=${encodeURIComponent(commitHash)}`,
    ),

  getGhStatus: (path: string) =>
    api.get<GitHubCLIStatus>(
      `/api/fs/gh-status?path=${encodeURIComponent(path)}`,
    ),

  getGitHubPRs: (path: string, state = "open", limit = 20) =>
    api.get<GitHubPRListResponse>(
      `/api/fs/gh-prs?path=${encodeURIComponent(path)}&state=${state}&limit=${limit}`,
    ),

  getGitHubPRDetail: (path: string, number: number) =>
    api.get<GitHubPRDetail>(
      `/api/fs/gh-pr-detail?path=${encodeURIComponent(path)}&number=${number}`,
    ),

  getGitHubPRDiff: (path: string, number: number) =>
    api.getText(
      `/api/fs/gh-pr-diff?path=${encodeURIComponent(path)}&number=${number}`,
    ),
};
