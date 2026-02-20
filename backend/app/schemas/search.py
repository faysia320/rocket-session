"""세션 검색/필터 관련 스키마."""

from pydantic import BaseModel

from app.schemas.session import SessionInfo


class PaginatedSessionsResponse(BaseModel):
    """페이징된 세션 목록 응답."""

    items: list[SessionInfo]
    total: int
    limit: int
    offset: int
