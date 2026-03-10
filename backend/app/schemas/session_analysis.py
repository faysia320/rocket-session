"""세션 분석 결과 스키마."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TokenSummary(BaseModel):
    """토큰 사용 요약."""

    input: int = 0
    output: int = 0
    cache_read: int = 0
    cache_create: int = 0


class SessionSummary(BaseModel):
    """세션 분석 요약."""

    session_id: str
    workspace_id: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: int = 0
    turn_count: int = 0
    workflow_enabled: bool = False
    workflow_phases_traversed: list[str] = []
    workflow_completed: bool = False
    total_tokens: TokenSummary = TokenSummary()
    total_cost_usd: float = 0.0
    tools_used: dict[str, int] = {}
    error_count: int = 0
    stall_count: int = 0
    retry_count: int = 0
    ask_user_question_count: int = 0
    original_prompt: str = ""
