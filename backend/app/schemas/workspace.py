"""워크스페이스 관련 Pydantic 요청/응답 스키마."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class CreateWorkspaceRequest(BaseModel):
    repo_url: str = Field(..., min_length=1, description="Git 저장소 URL")
    branch: Optional[str] = Field(None, description="클론할 브랜치 (기본: 기본 브랜치)")
    name: Optional[str] = Field(
        None, max_length=100, description="워크스페이스 표시 이름"
    )


class UpdateWorkspaceRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=100)


class WorkspaceInfo(BaseModel):
    id: str
    name: str
    repo_url: str
    branch: Optional[str] = None
    local_path: str
    status: str
    error_message: Optional[str] = None
    disk_usage_mb: Optional[int] = None
    last_synced_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Git 실시간 정보 (ready 상태일 때만)
    current_branch: Optional[str] = None
    is_dirty: Optional[bool] = None
    ahead: Optional[int] = None
    behind: Optional[int] = None


class WorkspaceSyncRequest(BaseModel):
    action: Literal["pull", "push"] = Field(..., description="동기화 방향")
    force: bool = Field(False, description="강제 pull (원격으로 리셋)")


class WorkspaceSyncResponse(BaseModel):
    success: bool
    message: str
    commit_hash: Optional[str] = None
