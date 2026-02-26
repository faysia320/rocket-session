"""세션 관련 Pydantic 요청/응답 스키마."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.tag import TagInfo


class CreateSessionRequest(BaseModel):
    work_dir: Optional[str] = None
    allowed_tools: Optional[str] = None
    system_prompt: Optional[str] = None
    timeout_seconds: Optional[int] = Field(None, ge=1, le=7200)
    permission_mode: Optional[bool] = None
    permission_required_tools: Optional[list[str]] = None
    model: Optional[str] = None
    max_turns: Optional[int] = Field(None, ge=1, le=1000)
    max_budget_usd: Optional[float] = Field(None, gt=0)
    system_prompt_mode: Optional[Literal["replace", "append"]] = None
    disallowed_tools: Optional[str] = None
    mcp_server_ids: Optional[list[str]] = None
    additional_dirs: Optional[list[str]] = None
    fallback_model: Optional[str] = None
    worktree_name: Optional[str] = None
    workspace_id: Optional[str] = None
    branch: Optional[str] = None
    workflow_definition_id: Optional[str] = None


class UpdateSessionRequest(BaseModel):
    allowed_tools: Optional[str] = None
    system_prompt: Optional[str] = None
    timeout_seconds: Optional[int] = Field(None, ge=1, le=7200)
    permission_mode: Optional[bool] = None
    permission_required_tools: Optional[list[str]] = None
    name: Optional[str] = None
    model: Optional[str] = None
    max_turns: Optional[int] = Field(None, ge=1, le=1000)
    max_budget_usd: Optional[float] = Field(None, gt=0)
    system_prompt_mode: Optional[Literal["replace", "append"]] = None
    disallowed_tools: Optional[str] = None
    mcp_server_ids: Optional[list[str]] = None
    additional_dirs: Optional[list[str]] = None
    fallback_model: Optional[str] = None
    work_dir: Optional[str] = None
    worktree_name: Optional[str] = None


class CurrentActivity(BaseModel):
    """세션의 현재 활동 정보."""

    tool: str  # "Read", "Write", "Bash", "__thinking__" 등
    input: dict = {}  # {"file_path": "...", "command": "..."} 등


class SessionInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    claude_session_id: Optional[str] = None
    work_dir: str
    status: str
    created_at: datetime
    message_count: int = 0
    file_changes_count: int = 0
    allowed_tools: Optional[str] = None
    system_prompt: Optional[str] = None
    timeout_seconds: Optional[int] = None
    workflow_enabled: bool = True
    workflow_phase: Optional[str] = None
    workflow_phase_status: Optional[str] = None
    permission_mode: bool = False
    permission_required_tools: Optional[list[str]] = None
    name: Optional[str] = None
    model: Optional[str] = None
    max_turns: Optional[int] = None
    max_budget_usd: Optional[float] = None
    system_prompt_mode: str = "replace"
    disallowed_tools: Optional[str] = None
    mcp_server_ids: Optional[list[str]] = None
    additional_dirs: Optional[list[str]] = None
    fallback_model: Optional[str] = None
    workspace_id: Optional[str] = None
    worktree_name: Optional[str] = None
    parent_session_id: Optional[str] = None
    forked_at_message_id: Optional[int] = None
    workflow_definition_id: Optional[str] = None
    tags: list[TagInfo] = []
    current_activity: Optional[CurrentActivity] = None


class ForkSessionRequest(BaseModel):
    """세션 포크 요청. message_id가 None이면 전체 메시지 복사."""

    message_id: Optional[int] = None


class ConvertToWorktreeRequest(BaseModel):
    """기존 세션을 Git 워크트리로 전환 요청."""

    worktree_name: str = Field(
        ..., min_length=1, description="워크트리 이름 (claude -w에 전달)"
    )
