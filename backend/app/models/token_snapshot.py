"""토큰 스냅샷 모델 — 세션 삭제와 무관하게 토큰 사용량을 영구 보존."""

from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TokenSnapshot(Base):
    """token_snapshots 테이블 ORM 모델.

    세션이 삭제되어도 토큰 사용량 기록을 보존하기 위해
    sessions 테이블에 FK를 걸지 않는 독립 테이블.
    """

    __tablename__ = "token_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String, nullable=False)
    work_dir: Mapped[str] = mapped_column(Text, nullable=False)
    workflow_phase: Mapped[str | None] = mapped_column(String, default=None, nullable=True)
    model: Mapped[str | None] = mapped_column(String, default=None, nullable=True)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_creation_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_read_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("idx_token_snapshots_session_id", "session_id"),
        Index("idx_token_snapshots_timestamp", "timestamp"),
        Index("idx_token_snapshots_workflow_phase", "workflow_phase"),
        Index("idx_token_snapshots_work_dir", "work_dir"),
    )
