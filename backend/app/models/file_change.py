"""파일 변경 기록 모델."""

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class FileChange(Base):
    """file_changes 테이블 ORM 모델."""

    __tablename__ = "file_changes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    tool: Mapped[str] = mapped_column(String, nullable=False)
    file: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationship
    session: Mapped["Session"] = relationship("Session", back_populates="file_changes")

    __table_args__ = (
        Index("idx_file_changes_session_id", "session_id"),
    )
