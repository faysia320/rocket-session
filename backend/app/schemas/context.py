"""컨텍스트 자동 빌딩 Pydantic 스키마."""

from pydantic import BaseModel

from app.schemas.claude_memory import MemoryFileInfo


class FileSuggestion(BaseModel):
    file_path: str
    reason: str
    score: float


class SessionSummary(BaseModel):
    id: str
    name: str | None = None
    status: str
    created_at: str | None = None
    prompt_preview: str = ""
    file_count: int = 0


class SessionContextSuggestion(BaseModel):
    memory_files: list[MemoryFileInfo]
    recent_sessions: list[SessionSummary]
    suggested_files: list[FileSuggestion]
    context_text: str
