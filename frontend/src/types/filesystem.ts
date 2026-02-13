/** 파일시스템 탐색 + Git 정보 타입 정의. */

export interface DirectoryEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_git_repo: boolean;
}

export interface DirectoryListResponse {
  path: string;
  parent: string | null;
  entries: DirectoryEntry[];
}

export interface GitInfo {
  is_git_repo: boolean;
  branch: string | null;
  is_dirty: boolean;
  has_untracked: boolean;
  last_commit_message: string | null;
  last_commit_hash: string | null;
  last_commit_date: string | null;
  remote_url: string | null;
  ahead: number;
  behind: number;
  is_worktree: boolean;
}

export interface WorktreeInfo {
  path: string;
  branch: string | null;
  commit_hash: string | null;
  is_main: boolean;
}

export interface WorktreeListResponse {
  worktrees: WorktreeInfo[];
}

export interface CreateWorktreeRequest {
  repo_path: string;
  branch: string;
  target_path?: string;
  create_branch: boolean;
}

export interface SkillInfo {
  name: string;
  filename: string;
  description: string;
  scope: 'project' | 'user';
}

export interface SkillListResponse {
  skills: SkillInfo[];
}
