"""세션 관련 Pydantic 요청/응답 스키마."""

from typing import Optional

from pydantic import BaseModel


class CreateSessionRequest(BaseModel):
    work_dir: Optional[str] = None


class SendPromptRequest(BaseModel):
    prompt: str
    allowed_tools: Optional[str] = None


class SessionInfo(BaseModel):
    id: str
    claude_session_id: Optional[str]
    work_dir: str
    status: str
    created_at: str
    message_count: int
    file_changes_count: int
