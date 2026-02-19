"""세션 관련 Pydantic 요청/응답 스키마."""

from typing import Literal, Optional

from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    work_dir: Optional[str] = None
    allowed_tools: Optional[str] = None
    system_prompt: Optional[str] = None
    timeout_seconds: Optional[int] = Field(None, ge=1, le=7200)
    mode: Optional[Literal["normal", "plan"]] = None
    permission_mode: Optional[bool] = None
    permission_required_tools: Optional[list[str]] = None
    model: Optional[str] = None
    max_turns: Optional[int] = Field(None, ge=1, le=1000)
    max_budget_usd: Optional[float] = Field(None, gt=0)
    system_prompt_mode: Optional[Literal["replace", "append"]] = None
    disallowed_tools: Optional[str] = None
    mcp_server_ids: Optional[list[str]] = None


class UpdateSessionRequest(BaseModel):
    allowed_tools: Optional[str] = None
    system_prompt: Optional[str] = None
    timeout_seconds: Optional[int] = Field(None, ge=1, le=7200)
    mode: Optional[Literal["normal", "plan"]] = None
    permission_mode: Optional[bool] = None
    permission_required_tools: Optional[list[str]] = None
    name: Optional[str] = None
    model: Optional[str] = None
    max_turns: Optional[int] = Field(None, ge=1, le=1000)
    max_budget_usd: Optional[float] = Field(None, gt=0)
    system_prompt_mode: Optional[Literal["replace", "append"]] = None
    disallowed_tools: Optional[str] = None
    mcp_server_ids: Optional[list[str]] = None


class CurrentActivity(BaseModel):
    """세션의 현재 활동 정보."""

    tool: str  # "Read", "Write", "Bash", "__thinking__" 등
    input: dict = {}  # {"file_path": "...", "command": "..."} 등


class SessionInfo(BaseModel):
    id: str
    claude_session_id: Optional[str] = None
    work_dir: str
    status: str
    created_at: str
    message_count: int = 0
    file_changes_count: int = 0
    allowed_tools: Optional[str] = None
    system_prompt: Optional[str] = None
    timeout_seconds: Optional[int] = None
    mode: str = "normal"
    permission_mode: bool = False
    permission_required_tools: Optional[list[str]] = None
    name: Optional[str] = None
    model: Optional[str] = None
    max_turns: Optional[int] = None
    max_budget_usd: Optional[float] = None
    system_prompt_mode: str = "replace"
    disallowed_tools: Optional[str] = None
    mcp_server_ids: Optional[list[str]] = None
    current_activity: Optional[CurrentActivity] = None
