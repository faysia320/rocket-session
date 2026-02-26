"""세션 모델 및 상태 열거형."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.file_change import FileChange
    from app.models.message import Message
    from app.models.tag import SessionTag
    from app.models.workspace import Workspace


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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    allowed_tools: Mapped[str | None] = mapped_column(Text, default=None)
    system_prompt: Mapped[str | None] = mapped_column(Text, default=None)
    timeout_seconds: Mapped[int | None] = mapped_column(Integer, default=None)
    workflow_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    workflow_phase: Mapped[str | None] = mapped_column(String, default=None)
    workflow_phase_status: Mapped[str | None] = mapped_column(String, default=None)
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
    workspace_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("workspaces.id", ondelete="SET NULL"), default=None
    )
    worktree_name: Mapped[str | None] = mapped_column(String, default=None)
    parent_session_id: Mapped[str | None] = mapped_column(String, default=None)
    forked_at_message_id: Mapped[int | None] = mapped_column(Integer, default=None)
    search_vector: Mapped[str | None] = mapped_column(TSVECTOR, default=None)
    workflow_original_prompt: Mapped[str | None] = mapped_column(Text, default=None)
    workflow_definition_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("workflow_definitions.id", ondelete="SET NULL"), default=None
    )

    # Relationships — lazy="raise"로 실수로 N+1 쿼리가 발생하는 것을 방지
    # 필요 시 selectinload()로 명시적으로 로드해야 함
    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    file_changes: Mapped[list["FileChange"]] = relationship(
        "FileChange",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    events: Mapped[list["Event"]] = relationship(
        "Event", back_populates="session", cascade="all, delete-orphan", lazy="raise"
    )
    tags: Mapped[list["SessionTag"]] = relationship(
        "SessionTag",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    workspace: Mapped["Workspace | None"] = relationship(
        "Workspace",
        back_populates="sessions",
        lazy="raise",
    )

    __table_args__ = (
        Index("idx_sessions_created_at", "created_at"),
        Index("idx_sessions_claude_session_id", "claude_session_id"),
        Index("idx_sessions_status", "status"),
        Index("idx_sessions_model", "model"),
        Index("idx_sessions_work_dir", "work_dir"),
        Index("idx_sessions_search_vector", "search_vector", postgresql_using="gin"),
        Index("idx_sessions_parent_session_id", "parent_session_id"),
        Index("idx_sessions_workspace_id", "workspace_id"),
    )
