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

export interface GitStatusFile {
  path: string;
  status: string;
  is_staged: boolean;
  is_unstaged: boolean;
  is_untracked: boolean;
}

export interface GitStatusResponse {
  is_git_repo: boolean;
  repo_root: string | null;
  files: GitStatusFile[];
  total_count: number;
  error?: string | null;
}

export interface SkillInfo {
  name: string;
  filename: string;
  description: string;
  scope: "project" | "user";
}

export interface SkillListResponse {
  skills: SkillInfo[];
}

// --- Git Log ---

export interface GitCommitEntry {
  hash: string;
  full_hash: string;
  message: string;
  body: string | null;
  author_name: string;
  author_email: string;
  date: string;
}

export interface GitLogResponse {
  commits: GitCommitEntry[];
  total_count: number;
  has_more: boolean;
  error?: string | null;
}

// --- GitHub PR ---

export interface GitHubCLIStatus {
  installed: boolean;
  authenticated: boolean;
  version?: string | null;
  error?: string | null;
}

export interface GitHubPREntry {
  number: number;
  title: string;
  state: string;
  author: string;
  branch: string;
  base: string;
  created_at: string;
  updated_at: string;
  url: string;
  labels: string[];
  draft: boolean;
  additions: number;
  deletions: number;
}

export interface GitHubPRListResponse {
  prs: GitHubPREntry[];
  total_count: number;
  error?: string | null;
}

export interface GitHubPRReview {
  author: string;
  state: string;
  body: string;
  submitted_at: string;
}

export interface GitHubPRComment {
  author: string;
  body: string;
  created_at: string;
  path?: string | null;
  line?: number | null;
}

export interface GitHubPRDetail {
  number: number;
  title: string;
  body: string;
  state: string;
  author: string;
  branch: string;
  base: string;
  created_at: string;
  updated_at: string;
  url: string;
  labels: string[];
  additions: number;
  deletions: number;
  changed_files: number;
  commits_count: number;
  reviews: GitHubPRReview[];
  comments: GitHubPRComment[];
  mergeable?: string | null;
  error?: string | null;
}
