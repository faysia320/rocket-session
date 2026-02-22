"""세션 모델 및 상태 열거형."""

from enum import Enum

from sqlalchemy import Boolean, Float, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class SessionStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    ERROR = "error"
    ARCHIVED = "archived"


class Session(Base):
    """sessions 테이블 ORM 모델."""

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    claude_session_id: Mapped[str | None] = mapped_column(String, default=None)
    work_dir: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="idle")
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    allowed_tools: Mapped[str | None] = mapped_column(Text, default=None)
    system_prompt: Mapped[str | None] = mapped_column(Text, default=None)
    timeout_seconds: Mapped[int | None] = mapped_column(Integer, default=None)
    mode: Mapped[str] = mapped_column(String, nullable=False, default="normal")
    permission_mode: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    permission_required_tools: Mapped[dict | list | None] = mapped_column(
        JSONB, default=None
    )
    name: Mapped[str | None] = mapped_column(Text, default=None)
    jsonl_path: Mapped[str | None] = mapped_column(Text, default=None)
    model: Mapped[str | None] = mapped_column(String, default=None)
    max_turns: Mapped[int | None] = mapped_column(Integer, default=None)
    max_budget_usd: Mapped[float | None] = mapped_column(Float, default=None)
    system_prompt_mode: Mapped[str] = mapped_column(
        String, nullable=False, default="replace"
    )
    disallowed_tools: Mapped[str | None] = mapped_column(Text, default=None)
    mcp_server_ids: Mapped[list | None] = mapped_column(JSONB, default=None)
    additional_dirs: Mapped[list | None] = mapped_column(JSONB, default=None)
    fallback_model: Mapped[str | None] = mapped_column(String, default=None)
    parent_session_id: Mapped[str | None] = mapped_column(String, default=None)
    forked_at_message_id: Mapped[int | None] = mapped_column(Integer, default=None)
    search_vector: Mapped[str | None] = mapped_column(TSVECTOR, default=None)

    # Relationships
    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    file_changes: Mapped[list["FileChange"]] = relationship(
        "FileChange",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    events: Mapped[list["Event"]] = relationship(
        "Event", back_populates="session", cascade="all, delete-orphan", lazy="selectin"
    )
    tags: Mapped[list["SessionTag"]] = relationship(
        "SessionTag",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        Index("idx_sessions_created_at", "created_at"),
        Index("idx_sessions_claude_session_id", "claude_session_id"),
        Index("idx_sessions_status", "status"),
        Index("idx_sessions_model", "model"),
        Index("idx_sessions_work_dir", "work_dir"),
        Index("idx_sessions_search_vector", "search_vector", postgresql_using="gin"),
        Index("idx_sessions_parent_session_id", "parent_session_id"),
    )
