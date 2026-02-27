"""워크스페이스 인사이트 Pydantic 스키마."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

InsightCategory = Literal["pattern", "gotcha", "decision", "file_map", "dependency"]


class WorkspaceInsightInfo(BaseModel):
    """인사이트 응답 스키마."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    workspace_id: str
    session_id: Optional[str] = None
    category: str
    title: str
    content: str
    relevance_score: float
    tags: Optional[list[str]] = None
    file_paths: Optional[list[str]] = None
    is_auto_generated: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class CreateInsightRequest(BaseModel):
    """인사이트 수동 생성 요청."""

    category: InsightCategory
    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1)
    tags: Optional[list[str]] = None
    file_paths: Optional[list[str]] = None


class UpdateInsightRequest(BaseModel):
    """인사이트 부분 수정 요청."""

    title: Optional[str] = Field(None, min_length=1, max_length=500)
    content: Optional[str] = Field(None, min_length=1)
    category: Optional[InsightCategory] = None
    tags: Optional[list[str]] = None
    file_paths: Optional[list[str]] = None
    relevance_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    is_archived: Optional[bool] = None


class ExtractInsightsRequest(BaseModel):
    """세션에서 인사이트 자동 추출 요청."""

    session_id: str


class ArchiveInsightsRequest(BaseModel):
    """인사이트 다건 아카이브 요청."""

    ids: list[int] = Field(..., min_length=1)


class InsightContextResponse(BaseModel):
    """컨텍스트 주입용 인사이트 응답."""

    insights: list[WorkspaceInsightInfo]
    context_text: str
