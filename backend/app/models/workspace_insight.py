"""워크스페이스 인사이트 모델 — 세션에서 추출한 지식을 워크스페이스별로 축적."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class WorkspaceInsight(Base):
    """workspace_insights 테이블 ORM 모델.

    세션 완료 시 자동 추출되거나 사용자가 수동으로 생성한 인사이트를
    워크스페이스 단위로 관리합니다.

    카테고리:
        - pattern: 코드 컨벤션, 반복 패턴
        - gotcha: 주의사항, 엣지 케이스, 함정
        - decision: 아키텍처 결정, 기술 선택 이유
        - file_map: 파일/디렉토리 목적 매핑
        - dependency: 의존성 관계 정보
    """

    __tablename__ = "workspace_insights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workspace_id: Mapped[str] = mapped_column(String, nullable=False)
    session_id: Mapped[str | None] = mapped_column(String, default=None)
    category: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    relevance_score: Mapped[float] = mapped_column(Float, default=1.0)
    tags: Mapped[list | None] = mapped_column(JSONB, default=None)
    file_paths: Mapped[list | None] = mapped_column(JSONB, default=None)
    is_auto_generated: Mapped[bool] = mapped_column(Boolean, default=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    __table_args__ = (
        Index("idx_workspace_insights_workspace_id", "workspace_id"),
        Index("idx_workspace_insights_category", "category"),
        Index("idx_workspace_insights_workspace_category", "workspace_id", "category"),
        Index("idx_workspace_insights_session_id", "session_id"),
    )
