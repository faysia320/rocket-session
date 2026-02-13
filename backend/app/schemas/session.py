"""세션 관련 Pydantic 요청/응답 스키마."""

from typing import Optional

from pydantic import BaseModel


class CreateSessionRequest(BaseModel):
    work_dir: Optional[str] = None
    allowed_tools: Optional[str] = None
    system_prompt: Optional[str] = None
    timeout_seconds: Optional[int] = None
    mode: Optional[str] = None
    permission_mode: Optional[bool] = None
    permission_required_tools: Optional[list[str]] = None


class UpdateSessionRequest(BaseModel):
    allowed_tools: Optional[str] = None
    system_prompt: Optional[str] = None
    timeout_seconds: Optional[int] = None
    mode: Optional[str] = None
    permission_mode: Optional[bool] = None
    permission_required_tools: Optional[list[str]] = None


class SendPromptRequest(BaseModel):
    prompt: str
    allowed_tools: Optional[str] = None


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
