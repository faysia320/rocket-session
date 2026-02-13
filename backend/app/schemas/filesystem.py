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
