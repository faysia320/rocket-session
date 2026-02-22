"""파일시스템 탐색 + Git 정보 Pydantic 스키마."""

from typing import Optional
from pydantic import BaseModel


class DirectoryEntry(BaseModel):
    name: str
    path: str
    is_dir: bool
    is_git_repo: bool = False


class DirectoryListResponse(BaseModel):
    path: str
    parent: Optional[str] = None
    entries: list[DirectoryEntry]


class GitInfo(BaseModel):
    is_git_repo: bool = False
    branch: Optional[str] = None
    is_dirty: bool = False
    has_untracked: bool = False
    last_commit_message: Optional[str] = None
    last_commit_hash: Optional[str] = None
    last_commit_date: Optional[str] = None
    remote_url: Optional[str] = None
    ahead: int = 0
    behind: int = 0
    is_worktree: bool = False


class WorktreeInfo(BaseModel):
    path: str
    branch: Optional[str] = None
    commit_hash: Optional[str] = None
    is_main: bool = False


class WorktreeListResponse(BaseModel):
    worktrees: list[WorktreeInfo]


class CreateWorktreeRequest(BaseModel):
    repo_path: str
    branch: str
    target_path: Optional[str] = None
    create_branch: bool = False


class GitStatusFile(BaseModel):
    """git status --porcelain 한 줄 파싱 결과."""

    path: str
    status: str  # "M ", " M", "??", "A " 등
    is_staged: bool
    is_unstaged: bool
    is_untracked: bool


class GitStatusResponse(BaseModel):
    is_git_repo: bool
    repo_root: Optional[str] = None
    files: list[GitStatusFile] = []
    total_count: int = 0
    error: Optional[str] = None


class SkillInfo(BaseModel):
    name: str  # 파일명(확장자 제외) → 슬래시 명령어 이름
    filename: str  # 원본 파일명 (e.g. "commit.md")
    description: str  # .md 파일 첫 줄 (빈 줄 제외)
    scope: str  # "project" (.claude/commands/) 또는 "user" (~/.claude/commands/)


class SkillListResponse(BaseModel):
    skills: list[SkillInfo]


# --- Git Log 스키마 ---


class GitCommitEntry(BaseModel):
    """git log 한 항목."""

    hash: str
    full_hash: str
    message: str
    body: Optional[str] = None
    author_name: str
    author_email: str
    date: str


class GitLogResponse(BaseModel):
    commits: list[GitCommitEntry] = []
    total_count: int = 0
    has_more: bool = False
    error: Optional[str] = None


# --- GitHub PR 스키마 ---


class GitHubCLIStatus(BaseModel):
    """gh CLI 설치/인증 상태."""

    installed: bool = False
    authenticated: bool = False
    version: Optional[str] = None
    error: Optional[str] = None


class GitHubPREntry(BaseModel):
    """gh pr list 한 항목."""

    number: int
    title: str
    state: str
    author: str
    branch: str
    base: str
    created_at: str
    updated_at: str
    url: str
    labels: list[str] = []
    draft: bool = False
    additions: int = 0
    deletions: int = 0


class GitHubPRListResponse(BaseModel):
    prs: list[GitHubPREntry] = []
    total_count: int = 0
    error: Optional[str] = None


class GitHubPRReview(BaseModel):
    author: str
    state: str
    body: str
    submitted_at: str


class GitHubPRComment(BaseModel):
    author: str
    body: str
    created_at: str
    path: Optional[str] = None
    line: Optional[int] = None


class GitHubPRDetail(BaseModel):
    """gh pr view 상세."""

    number: int
    title: str
    body: str
    state: str
    author: str
    branch: str
    base: str
    created_at: str
    updated_at: str
    url: str
    labels: list[str] = []
    additions: int = 0
    deletions: int = 0
    changed_files: int = 0
    commits_count: int = 0
    reviews: list[GitHubPRReview] = []
    comments: list[GitHubPRComment] = []
    mergeable: Optional[str] = None
    error: Optional[str] = None
