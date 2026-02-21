"""WebSocket 이벤트 버퍼 모델."""

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Event(Base):
    """events 테이블 ORM 모델."""

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    timestamp: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationship
    session: Mapped["Session"] = relationship("Session", back_populates="events")

    __table_args__ = (
        Index("idx_events_session_seq", "session_id", "seq"),
        Index("idx_events_timestamp", "timestamp"),
    )
