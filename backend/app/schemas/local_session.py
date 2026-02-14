"""로컬 세션 스캔/import Pydantic 스키마."""

from pydantic import BaseModel


class LocalSessionMeta(BaseModel):
    session_id: str
    project_dir: str
    cwd: str
    git_branch: str | None = None
    slug: str | None = None
    version: str | None = None
    first_timestamp: str | None = None
    last_timestamp: str | None = None
    file_size: int = 0
    message_count: int = 0
    already_imported: bool = False
    continuation_ids: list[str] = []


class ImportLocalSessionRequest(BaseModel):
    session_id: str
    project_dir: str


class ImportLocalSessionResponse(BaseModel):
    dashboard_session_id: str
    claude_session_id: str
    messages_imported: int
