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


class SkillInfo(BaseModel):
    name: str  # 파일명(확장자 제외) → 슬래시 명령어 이름
    filename: str  # 원본 파일명 (e.g. "commit.md")
    description: str  # .md 파일 첫 줄 (빈 줄 제외)
    scope: str  # "project" (.claude/commands/) 또는 "user" (~/.claude/commands/)


class SkillListResponse(BaseModel):
    skills: list[SkillInfo]
