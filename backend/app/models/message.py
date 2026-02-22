"""메시지 모델."""

from sqlalchemy import Boolean, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Message(Base):
    """messages 테이블 ORM 모델."""

    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    cost: Mapped[float | None] = mapped_column(Float, default=None)
    duration_ms: Mapped[int | None] = mapped_column(Integer, default=None)
    timestamp: Mapped[str] = mapped_column(Text, nullable=False)
    is_error: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    input_tokens: Mapped[int | None] = mapped_column(Integer, default=None)
    output_tokens: Mapped[int | None] = mapped_column(Integer, default=None)
    cache_creation_tokens: Mapped[int | None] = mapped_column(Integer, default=None)
    cache_read_tokens: Mapped[int | None] = mapped_column(Integer, default=None)
    model: Mapped[str | None] = mapped_column(String, default=None)

    # tool_use / tool_result 지원 컬럼
    message_type: Mapped[str | None] = mapped_column(String, default=None, nullable=True)
    tool_use_id: Mapped[str | None] = mapped_column(String, default=None, nullable=True)
    tool_name: Mapped[str | None] = mapped_column(String, default=None, nullable=True)
    tool_input: Mapped[dict | None] = mapped_column(JSONB, default=None, nullable=True)

    # Relationship
    session: Mapped["Session"] = relationship("Session", back_populates="messages")

    __table_args__ = (
        Index("idx_messages_session_id", "session_id"),
        Index("idx_messages_session_timestamp", "session_id", "timestamp"),
        Index("idx_messages_timestamp", "timestamp"),
        Index("idx_messages_model", "model"),
        Index("idx_messages_session_message_type", "session_id", "message_type"),
    )
