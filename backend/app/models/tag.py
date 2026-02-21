"""태그 및 세션-태그 연결 모델."""

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Tag(Base):
    """tags 테이블 ORM 모델."""

    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    color: Mapped[str] = mapped_column(String, nullable=False, default="#6366f1")
    created_at: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    session_tags: Mapped[list["SessionTag"]] = relationship(
        "SessionTag", back_populates="tag", cascade="all, delete-orphan"
    )


class SessionTag(Base):
    """session_tags 테이블 ORM 모델 (다대다 연결)."""

    __tablename__ = "session_tags"

    session_id: Mapped[str] = mapped_column(
        String, ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[str] = mapped_column(
        String, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    session: Mapped["Session"] = relationship("Session", back_populates="tags")
    tag: Mapped["Tag"] = relationship("Tag", back_populates="session_tags")

    __table_args__ = (
        Index("idx_session_tags_tag_id", "tag_id"),
        Index("idx_session_tags_session_id", "session_id"),
    )
